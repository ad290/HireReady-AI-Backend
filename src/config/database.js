const mongoose = require("mongoose")

let isConnected = false

async function connectToDB() {
    if (isConnected) {
        return
    }

    try {
        await mongoose.connect(process.env.MONGO_URI)
        isConnected = true
        console.log("Connected to Database")
    } catch (err) {
        console.log(err)
        throw err
    }
}

module.exports = connectToDB
