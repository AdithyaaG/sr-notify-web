import { db } from './firebase-config.js';
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export async function recordNoticeView(noticeId) {
    const studentId = localStorage.getItem("userReg"); 
    const studentName = localStorage.getItem("userName"); 

    if (!studentId || !noticeId) {
        console.warn("View tracking skipped: Missing Student ID or Notice ID");
        return;
    }

    try {
        const viewRef = doc(db, "notices", noticeId, "views", studentId);
        
        await setDoc(viewRef, {
            viewerName: studentName,
            viewedAt: serverTimestamp(), // Analytics now looks for this exact name
            studentId: studentId
        }, { merge: true });
        
        console.log("View tracked successfully for student:", studentId);
    } catch (e) {
        console.error("Error tracking view:", e);
    }
}