const LOCAL_ORIGINS = ["http://localhost:5173"]

function getAllowedOrigins() {
    const origins = [...LOCAL_ORIGINS]

    if (process.env.FRONTEND_URL) {
        const frontendUrl = process.env.FRONTEND_URL.replace(/\/$/, "")
        if (!origins.includes(frontendUrl)) {
            origins.push(frontendUrl)
        }
    }

    return origins
}

module.exports = { getAllowedOrigins }
