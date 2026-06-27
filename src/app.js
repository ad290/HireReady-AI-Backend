const express = require("express")
const cookieParser = require("cookie-parser")
const cors = require("cors")
const { getAllowedOrigins } = require("./config/cors")

const app = express()

app.get("/", (_req, res) => {
    res.status(200).json({ message: "Hire Ready AI backend is running" })
})

app.use(express.json())
app.use(cookieParser())
app.use(cors({
    origin: getAllowedOrigins(),
    credentials: true
}))

/* require all the routes here */
const authRouter = require("./routes/auth.routes")
const interviewRouter = require("./routes/interview.routes")


/* using all the routes here */
app.use("/api/auth", authRouter)
app.use("/api/interview", interviewRouter)



module.exports = app