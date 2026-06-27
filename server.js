require("dotenv").config()
const app = require("./src/app")
const connectToDB = require("./src/config/database")

async function start() {
    await connectToDB()

    app.listen(3000, () => {
        console.log("Server is running on port 3000")
    })
}

start()
