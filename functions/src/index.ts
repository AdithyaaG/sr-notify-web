import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import axios from "axios";

admin.initializeApp();

export const sendNoticeNotification = functions.firestore
    .document("notices/{noticeId}")
    .onCreate(async (snapshot, context) => {
        const noticeData = snapshot.data();
        if (!noticeData) return;

        // --- REPLACE THESE WITH YOUR ACTUAL KEYS FROM ONESIGNAL ---
        const ONESIGNAL_APP_ID = "YOUR_ONESIGNAL_APP_ID"; 
        const ONESIGNAL_REST_API_KEY = "YOUR_REST_API_KEY";

        const notificationData = {
            app_id: ONESIGNAL_APP_ID,
            included_segments: ["Subscribed Users"],
            headings: { "en": "SR-Notify: " + (noticeData.title || "New Notice") },
            contents: { "en": "A new notice has been posted in your feed." },
            url: "https://sr-notify-web.vercel.app/"
        };

        try {
            await axios.post("https://onesignal.com/api/v1/notifications", notificationData, {
                headers: {
                    "Authorization": `Basic ${ONESIGNAL_REST_API_KEY}`,
                    "Content-Type": "application/json"
                }
            });
            console.log("Push notification sent successfully!");
        } catch (error) {
            console.error("Push notification failed:", error);
        }
    });