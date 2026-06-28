const fs = require("node:fs")
const os = require("node:os")

const { GoogleGenAI } = require("@google/genai")
const { z } = require("zod")
const { zodToJsonSchema } = require("zod-to-json-schema")

const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_GENAI_API_KEY
})


const interviewReportSchema = z.object({
    matchScore: z.number().describe("A score between 0 and 100 indicating how well the candidate's profile matches the job describe"),
    technicalQuestions: z.array(z.object({
        question: z.string().describe("The technical question can be asked in the interview"),
        intention: z.string().describe("The intention of interviewer behind asking this question"),
        answer: z.string().describe("How to answer this question, what points to cover, what approach to take etc.")
    })).describe("Technical questions that can be asked in the interview along with their intention and how to answer them"),
    behavioralQuestions: z.array(z.object({
        question: z.string().describe("The technical question can be asked in the interview"),
        intention: z.string().describe("The intention of interviewer behind asking this question"),
        answer: z.string().describe("How to answer this question, what points to cover, what approach to take etc.")
    })).describe("Behavioral questions that can be asked in the interview along with their intention and how to answer them"),
    skillGaps: z.array(z.object({
        skill: z.string().describe("The skill which the candidate is lacking"),
        severity: z.enum([ "low", "medium", "high" ]).describe("The severity of this skill gap, i.e. how important is this skill for the job and how much it can impact the candidate's chances")
    })).describe("List of skill gaps in the candidate's profile along with their severity"),
    preparationPlan: z.array(z.object({
        day: z.number().describe("The day number in the preparation plan, starting from 1"),
        focus: z.string().describe("The main focus of this day in the preparation plan, e.g. data structures, system design, mock interviews etc."),
        tasks: z.array(z.string()).describe("List of tasks to be done on this day to follow the preparation plan, e.g. read a specific book or article, solve a set of problems, watch a video etc.")
    })).describe("A day-wise preparation plan for the candidate to follow in order to prepare for the interview effectively"),
    title: z.string().describe("The title of the job for which the interview report is generated"),
})

async function generateInterviewReport({ resume, selfDescription, jobDescription }) {


    const prompt = `Generate an interview report for a candidate with the following details:
                        Resume: ${resume}
                        Self Description: ${selfDescription}
                        Job Description: ${jobDescription}
`

    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: zodToJsonSchema(interviewReportSchema),
        }
    })

    return JSON.parse(response.text)


}

function isExecutableFile(filePath) {
    if (!filePath) {
        return false
    }
    try {
        fs.accessSync(filePath, fs.constants.X_OK)
        return fs.statSync(filePath).isFile()
    } catch {
        return false
    }
}

/**
 * Prefer a real Chrome/Chromium install. Puppeteer's downloaded "Chrome for Testing"
 * under ~/.cache/puppeteer can be incomplete (dlopen … Framework: no such file).
 */
function resolveChromeExecutablePath() {
    const fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH
    if (fromEnv && isExecutableFile(fromEnv)) {
        return { executablePath: fromEnv, source: "PUPPETEER_EXECUTABLE_PATH or CHROME_PATH" }
    }

    const platform = os.platform()
    const candidates = []
    if (platform === "darwin") {
        candidates.push(
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
            "/Applications/Chromium.app/Contents/MacOS/Chromium",
            "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
        )
    } else if (platform === "linux") {
        candidates.push(
            "/usr/bin/google-chrome-stable",
            "/usr/bin/google-chrome",
            "/usr/bin/chromium-browser",
            "/usr/bin/chromium"
        )
    } else if (platform === "win32") {
        candidates.push(
            "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
            "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
        )
    }

    for (const p of candidates) {
        if (isExecutableFile(p)) {
            return { executablePath: p, source: `system candidate (${p})` }
        }
    }

    try {
        const bundled = require("puppeteer").executablePath()
        if (bundled && isExecutableFile(bundled)) {
            return { executablePath: bundled, source: "puppeteer bundled (cache)" }
        }
    } catch {
        /* no bundled browser */
    }

    return { executablePath: null, source: "none found" }
}

async function generatePdfFromHtml(htmlContent) {
    const puppeteer = require("puppeteer")
    const { executablePath, source } = resolveChromeExecutablePath()
    console.info("[Puppeteer] launching browser for resume PDF…", {
        executablePath: executablePath ?? "(puppeteer default — may use broken cache)",
        resolvedFrom: source,
    })

    let browser
    try {
        browser = await puppeteer.launch({
            headless: true,
            ...(executablePath ? { executablePath } : {}),
        })
        const page = await browser.newPage()
        await page.setContent(htmlContent, { waitUntil: "networkidle0" })

        const pdfBuffer = await page.pdf({
            format: "A4", margin: {
                top: "20mm",
                bottom: "20mm",
                left: "15mm",
                right: "15mm"
            }
        })

        console.info("[Puppeteer] PDF buffer created", {
            bytes: Buffer.isBuffer(pdfBuffer) ? pdfBuffer.length : pdfBuffer?.byteLength,
        })

        return pdfBuffer
    } catch (err) {
        const hint = executablePath
            ? " If this persists, try a different browser binary via PUPPETEER_EXECUTABLE_PATH."
            : " Install Google Chrome (or Chromium), or set PUPPETEER_EXECUTABLE_PATH in Backend/.env to the full path of the chrome binary."
        console.error("[Puppeteer] failed to render PDF", {
            message: err?.message,
            stack: err?.stack,
            hint,
        })
        const wrapped = new Error(`${err?.message || err}${hint}`)
        wrapped.cause = err
        throw wrapped
    } finally {
        if (browser) {
            await browser.close().catch((closeErr) => {
                console.warn("[Puppeteer] browser.close() warning", closeErr?.message)
            })
        }
    }
}

async function generateResumePdf({ resume, selfDescription, jobDescription }) {
    console.info("[Resume PDF] starting Gemini HTML generation…")

    const resumePdfSchema = z.object({
        html: z.string().describe("The HTML content of the resume which can be converted to PDF using any library like puppeteer")
    })

    const prompt = `Generate resume for a candidate with the following details:
                        Resume: ${resume}
                        Self Description: ${selfDescription}
                        Job Description: ${jobDescription}

                        the response should be a JSON object with a single field "html" which contains the HTML content of the resume which can be converted to PDF using any library like puppeteer.
                        The resume should be tailored for the given job description and should highlight the candidate's strengths and relevant experience. The HTML content should be well-formatted and structured, making it easy to read and visually appealing.
                        The content of resume should be not sound like it's generated by AI and should be as close as possible to a real human-written resume.
                        you can highlight the content using some colors or different font styles but the overall design should be simple and professional.
                        The content should be ATS friendly, i.e. it should be easily parsable by ATS systems without losing important information.
                        The resume should not be so lengthy, it should ideally be 1-2 pages long when converted to PDF. Focus on quality rather than quantity and make sure to include all the relevant information that can increase the candidate's chances of getting an interview call for the given job description.
                    `

    let response
    try {
        response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: zodToJsonSchema(resumePdfSchema),
            }
        })
    } catch (err) {
        console.error("[Resume PDF] Gemini generateContent failed", {
            message: err?.message,
            stack: err?.stack,
        })
        throw err
    }


    let jsonContent
    try {
        jsonContent = JSON.parse(response.text)
    } catch (parseErr) {
        console.error("[Resume PDF] invalid JSON from model", {
            message: parseErr?.message,
            textPreview: typeof response.text === "string" ? response.text.slice(0, 500) : "(non-string)",
        })
        throw parseErr
    }

    console.info("[Resume PDF] HTML from model received", {
        htmlLength: jsonContent?.html?.length ?? 0,
    })

    const pdfBuffer = await generatePdfFromHtml(jsonContent.html)

    return pdfBuffer

}

module.exports = { generateInterviewReport, generateResumePdf }