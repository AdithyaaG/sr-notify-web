import { db, auth } from './firebase-config.js';
import { 
    collection, 
    addDoc, 
    getDocs, 
    query, 
    where, 
    serverTimestamp, 
    Timestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const CLOUD_NAME = "dfie8haie"; 
const UPLOAD_PRESET = "sr_notices"; 

// Initialize the target mode (Default to class)
window.currentTargetMode = 'class';

// --- NEW: OneSignal Trigger Function ---
async function sendPushNotification(title, content, targetCode) {
    const ONESIGNAL_APP_ID = "553381f2-480e-463c-a276-8bbce9288d11";
    const REST_API_KEY = "YOUR_REST_API_KEY"; // REPLACE WITH YOUR ACTUAL KEY FROM ONESIGNAL SETTINGS

    try {
        await fetch("https://onesignal.com/api/v1/notifications", {
            method: "POST",
            headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Authorization": `Basic ${REST_API_KEY}`
            },
            body: JSON.stringify({
                app_id: ONESIGNAL_APP_ID,
                headings: { "en": "New Notice: " + title },
                contents: { "en": content.substring(0, 100) + "..." },
                // This targets students based on the 'dept_code' tag we set in onesignal-init.js
                filters: [
                    { "field": "tag", "key": "dept_code", "relation": "=", "value": targetCode }
                ]
            })
        });
        console.log("Push Notification Sent Successfully");
    } catch (err) {
        console.error("OneSignal API Error:", err);
    }
}

async function uploadToCloudinary(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);

    try {
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, {
            method: 'POST',
            body: formData
        });
        if (!response.ok) throw new Error('Media upload failed');
        const data = await response.json();
        return { url: data.secure_url, type: data.resource_type };
    } catch (error) {
        console.error("Cloudinary Error:", error);
        return null;
    }
}

async function loadDeptBatches() {
    const deptCode = localStorage.getItem("userDept");
    const batchListDiv = document.getElementById('batchCheckboxList');
    if (!deptCode || !batchListDiv) return;

    try {
        const q = query(collection(db, "batches"), where("deptCode", "==", deptCode));
        const querySnap = await getDocs(q);
        batchListDiv.innerHTML = ""; 
        querySnap.forEach((docSnap) => {
            const batch = docSnap.data();
            batchListDiv.innerHTML += `
                <label style="font-size: 0.8rem; display: flex; align-items: center; gap: 8px; background: #f0f2f5; padding: 8px; border-radius: 8px;">
                    <input type="checkbox" name="selectedBatches" value="${docSnap.id}" 
                           data-start="${batch.start_reg}" data-end="${batch.end_reg}"> 
                    ${batch.name || docSnap.id}
                </label>
            `;
        });
    } catch (err) { console.error("Error loading batches:", err); }
}
loadDeptBatches();

window.publishStaffNotice = async function() {
    const title = document.getElementById('noticeTitle').value.trim();
    const content = document.getElementById('noticeContent').value.trim();
    const priority = document.getElementById('noticePriority').value; 
    const eventDateInput = document.getElementById('eventDate').value; 
    const expiryInput = document.getElementById('expiryDate').value;
    const fileInput = document.getElementById('staff-file-input');
    const postBtn = document.getElementById('publishBtn');
    
    const files = fileInput ? Array.from(fileInput.files) : [];
    const deptCode = localStorage.getItem("userDept"); 
    const authorName = localStorage.getItem("userName");
    const authorRole = localStorage.getItem("userRole") || "staff"; 

    if (!title || !content) { alert("Please fill in both the title and content!"); return; }

    const currentUser = auth.currentUser;
    if (!currentUser) { alert("Session expired. Please log in again."); return; }

    let targetCode = deptCode; 
    let audienceType = window.currentTargetMode; 
    let startReg = null;
    let endReg = null;

    if (audienceType === 'class') {
        const batchQuery = query(collection(db, "batches"), where("controller_email", "==", currentUser.email));
        const batchSnap = await getDocs(batchQuery);
        if (!batchSnap.empty) {
            const bData = batchSnap.docs[0].data();
            targetCode = batchSnap.docs[0].id; 
            startReg = Number(bData.start_reg);
            endReg = Number(bData.end_reg);
            audienceType = 'class';
        } else {
            alert("No class assigned to your email. Reverting to Department post.");
            audienceType = 'department';
            targetCode = deptCode;
        }
    } 
    else if (audienceType === 'dept' || audienceType === 'department') {
        audienceType = 'department'; 
        targetCode = deptCode;
        startReg = null;
        endReg = null;
    } 
    else if (audienceType === 'choose') {
        const selected = Array.from(document.querySelectorAll('input[name="selectedBatches"]:checked'));
        if (selected.length === 0) { alert("Select at least one batch!"); return; }
        targetCode = selected.map(cb => cb.value);
        audienceType = "multiple_batches";
    }

    const postedTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    postBtn.disabled = true;
    postBtn.innerText = "UPLOADING...";

    try {
        let attachments = [];
        for (let i = 0; i < files.length; i++) {
            const uploaded = await uploadToCloudinary(files[i]);
            if (uploaded) attachments.push(uploaded);
        }

        const finalNoticeData = {
            title, 
            content, 
            priority, 
            audienceType,
            event_date: eventDateInput || null,
            postedTime, 
            authorName, 
            authorEmail: currentUser.email,
            authorRole, 
            targetCode, 
            deptCode,
            start_reg: startReg, 
            end_reg: endReg,
            attachments, 
            createdAt: serverTimestamp(),
            expiresAt: expiryInput ? Timestamp.fromDate(new Date(expiryInput)) : null
        };

        // 1. Save to Firebase
        await addDoc(collection(db, "notices"), finalNoticeData);

        // 2. Trigger OneSignal Push Notification
        // For multiple batches, we notify the whole department for simplicity, or loop through codes.
        const pushTarget = Array.isArray(targetCode) ? deptCode : targetCode;
        await sendPushNotification(title, content, pushTarget);

        alert("Notice published successfully and students notified!");
        window.location.href = "staff_home.html"; 
    } catch (error) {
        console.error("Post Error:", error);
        alert("Error: " + error.message);
        postBtn.disabled = false;
        postBtn.innerText = "POST";
    }
};