const pdfParse = require("pdf-parse")
const { generateInterviewReport, generateResumePdf } = require("../services/ai.service")
const interviewReportModel = require("../models/interviewReport.model")




/**
 * @description Controller to generate interview report based on user self description, resume and job description.
 */
function isPdfUpload(file) {
    if (!file?.buffer?.length) {
        return false
    }
    const name = (file.originalname || "").toLowerCase()
    const type = (file.mimetype || "").toLowerCase()
    return type === "application/pdf" || name.endsWith(".pdf")
}

async function extractResumeTextFromFile(file) {
    const parsed = await (new pdfParse.PDFParse(Uint8Array.from(file.buffer))).getText()
    return (parsed?.text || "").trim()
}

async function generateInterViewReportController(req, res) {
    const jobDescription = String(req.body.jobDescription || "").trim()
    const selfDescription = String(req.body.selfDescription || "").trim()

    if (!jobDescription) {
        return res.status(400).json({ message: "Job description is required." })
    }

    let resumeText = ""

    if (req.file) {
        if (!isPdfUpload(req.file)) {
            return res.status(400).json({
                message: "Resume upload must be a PDF file. You can skip the file and use Quick Self-Description instead.",
            })
        }
        try {
            resumeText = await extractResumeTextFromFile(req.file)
        } catch (err) {
            console.error("[Interview] failed to parse resume PDF", err?.message)
            return res.status(400).json({ message: "Could not read the resume PDF. Try another file or use Quick Self-Description." })
        }
    }

    if (!resumeText && !selfDescription) {
        return res.status(400).json({
            message: "Either upload a resume (PDF) or fill in Quick Self-Description.",
        })
    }

    try {
        const interViewReportByAi = await generateInterviewReport({
            resume: resumeText || "(No resume file; rely on self description.)",
            selfDescription: selfDescription || "(None provided.)",
            jobDescription,
        })

        const interviewReport = await interviewReportModel.create({
            user: req.user.id,
            resume: resumeText,
            selfDescription,
            jobDescription,
            ...interViewReportByAi
        })

        res.status(201).json({
            message: "Interview report generated successfully.",
            interviewReport
        })
    } catch (err) {
        console.error("[Interview] generate report failed", err?.message)
        res.status(500).json({
            message: err?.message || "Failed to generate interview report.",
        })
    }
}

/**
 * @description Controller to get interview report by interviewId.
 */
async function getInterviewReportByIdController(req, res) {

    const { interviewId } = req.params

    const interviewReport = await interviewReportModel.findOne({ _id: interviewId, user: req.user.id })

    if (!interviewReport) {
        return res.status(404).json({
            message: "Interview report not found."
        })
    }

    res.status(200).json({
        message: "Interview report fetched successfully.",
        interviewReport
    })
}


/** 
 * @description Controller to get all interview reports of logged in user.
 */
async function getAllInterviewReportsController(req, res) {
    const interviewReports = await interviewReportModel.find({ user: req.user.id }).sort({ createdAt: -1 }).select("-resume -selfDescription -jobDescription -__v -technicalQuestions -behavioralQuestions -skillGaps -preparationPlan")

    res.status(200).json({
        message: "Interview reports fetched successfully.",
        interviewReports
    })
}


/**
 * @description Controller to generate resume PDF based on user self description, resume and job description.
 */
async function generateResumePdfController(req, res) {
    const { interviewReportId } = req.params

    console.info("[Download Resume PDF] request", {
        interviewReportId,
        userId: req.user?.id,
    })

    try {
        const interviewReport = await interviewReportModel.findById(interviewReportId)

        if (!interviewReport) {
            console.warn("[Download Resume PDF] report not found", { interviewReportId })
            return res.status(404).json({
                message: "Interview report not found."
            })
        }

        const { resume, jobDescription, selfDescription } = interviewReport

        const pdfBuffer = await generateResumePdf({ resume, jobDescription, selfDescription })

        console.info("[Download Resume PDF] success", {
            interviewReportId,
            bytes: Buffer.isBuffer(pdfBuffer) ? pdfBuffer.length : pdfBuffer?.byteLength,
        })

        res.set({
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename=resume_${interviewReportId}.pdf`
        })

        res.send(pdfBuffer)
    } catch (err) {
        console.error("[Download Resume PDF] error", {
            interviewReportId,
            message: err?.message,
            stack: err?.stack,
        })

        if (res.headersSent) {
            return
        }

        res.status(500).json({
            message: err?.message || "Failed to generate resume PDF",
        })
    }
}

/**
 * @description Controller to delete an interview report owned by the logged-in user.
 */
async function deleteInterviewReportController(req, res) {
    const { interviewId } = req.params

    const deleted = await interviewReportModel.findOneAndDelete({ _id: interviewId, user: req.user.id })

    if (!deleted) {
        return res.status(404).json({
            message: "Interview report not found.",
        })
    }

    res.status(200).json({
        message: "Interview report deleted successfully.",
    })
}

module.exports = {
    generateInterViewReportController,
    getInterviewReportByIdController,
    getAllInterviewReportsController,
    generateResumePdfController,
    deleteInterviewReportController,
}