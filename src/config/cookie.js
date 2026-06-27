function isProduction() {
    return process.env.NODE_ENV === "production" || process.env.VERCEL === "1"
}

function getAuthCookieOptions() {
    if (isProduction()) {
        return {
            httpOnly: true,
            sameSite: "none",
            secure: true,
        }
    }

    return { httpOnly: true }
}

module.exports = { getAuthCookieOptions }
