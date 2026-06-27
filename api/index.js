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

module.exports = async (req, res) => {
    await ensureDb()
    return app(req, res)
}
