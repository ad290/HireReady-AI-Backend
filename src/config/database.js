const mongoose = require("mongoose")

let isConnected = false

async function connectToDB() {
    if (isConnected) {
        return
    }

    if (!process.env.MONGO_URI) {
        throw new Error("MONGO_URI is not set. Add it in Vercel → Settings → Environment Variables.")
    }

    try {
        await mongoose.connect(process.env.MONGO_URI)
        isConnected = true
        console.log("Connected to Database")
    } catch (err) {
        console.error("Database connection failed:", err.message)
        throw err
    }
}

module.exports = connectToDB
