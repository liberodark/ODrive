module.exports = error => ["ECONNRESET", "ECONNREFUSED", "EAI_AGAIN"].includes(error.code);
