const axios = require("axios");

module.exports = {
    sendBrevoEmail: async (data) => {
        try {
            const emailData = {
                sender: {
                    name: "Manish Kumar",
                    email: "manish.kumarindiit@gmail.com",
                },
                to: [
                    {
                        email: data.receiver_email,
                        name: data.receiver_name,
                    },
                ],
                subject: data.subject,
                htmlContent: data.htmlContent,
            };

            const response = await axios.post(
                process.env.BREVO_EMAIL_URL,
                emailData,
                {
                    headers: {
                        accept: "application/json",
                        "Content-Type": "application/json",
                        "api-key": process.env.BREVO_API_KEY,
                    },
                }
            );

            console.log("Email sent=======:", response.data);
            return { STATUS_CODE: 200, data: response.data };
        } catch (error) {
            console.error(
                "Failed to send email:",
                error.response?.data || error.message
            );
            return {
                STATUS_CODE: 500,
                data: error.message || error.response?.data,
            };
        }
    }
}