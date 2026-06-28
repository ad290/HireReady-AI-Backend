require("dotenv").config()

const app = require("../src/app")
const connectToDB = require("../src/config/database")

let dbReady = null

function ensureDb() {
    if (!dbReady) {
        dbReady = connectToDB()
    }
    return dbReady
}

function isHealthCheck(req) {
    const path = (req.url || "").split("?")[0]
    return req.method === "GET" && (path === "/" || path === "")
}

module.exports = async (req, res) => {
    try {
        if (!isHealthCheck(req)) {
            await ensureDb()
        }

        return app(req, res)
    } catch (err) {
        console.error("[api] request failed:", err.message)

        if (!res.headersSent) {
            return res.status(500).json({
                message: "Server error",
                error: err.message,
            })
        }
    }
}
