import { db, auth } from './firebase-config.js';
import { 
    collection, query, where, orderBy, onSnapshot, doc, getDoc, 
    updateDoc, deleteDoc, serverTimestamp, Timestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const CLOUD_NAME = "dfie8haie"; 
const UPLOAD_PRESET = "sr_notices"; 
const container = document.getElementById('admin-notice-container');
let activeIntervals = {};

// 1. Helper: Cloudinary Upload
async function uploadToCloudinary(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);
    const statusText = document.getElementById('edit-upload-status');
    if (statusText) { 
        statusText.innerText = "Uploading attachment..."; 
        statusText.style.display = 'block'; 
    }

    try {
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, {
            method: 'POST',
            body: formData
        });
        if (!response.ok) throw new Error('Upload failed');
        const data = await response.json();
        if (statusText) statusText.style.display = 'none';
        return { url: data.secure_url, type: data.resource_type };
    } catch (error) {
        console.error("Cloudinary Error:", error);
        return null;
    }
}

// 2. Load Notices (Real-time)
auth.onAuthStateChanged((user) => {
    if (user) {
        // Query to get all notices where the author is 'admin'
        const q = query(
            collection(db, "notices"), 
            where("authorRole", "==", "admin"), 
            orderBy("createdAt", "desc")
        );

        onSnapshot(q, (snapshot) => {
            if (!container) return;
            
            // Clear existing timers to prevent memory leaks
            Object.values(activeIntervals).forEach(clearInterval);
            activeIntervals = {};
            container.innerHTML = '';

            if (snapshot.empty) {
                container.innerHTML = `<div style="text-align:center; padding:50px; color:#888;"><p>No official admin notices found.</p></div>`;
                return;
            }

            snapshot.forEach((snapDoc) => {
                const data = snapDoc.data();
                const id = snapDoc.id;
                
                // --- UI COLOR & STATUS LOGIC ---
                const isEvent = data.priority?.toLowerCase().includes('event');
                const accentColor = isEvent ? "#ff9800" : "#d32f2f";
                
                const expiryDate = data.expiresAt?.toDate ? data.expiresAt.toDate() : (data.expiresAt ? new Date(data.expiresAt) : null);
                const isExpired = expiryDate && expiryDate <= new Date();

                const card = `
                    <div class="dashboard-card" id="admin-card-${id}" style="background:white; padding:18px; margin-bottom:15px; border-radius:15px; border-left: 6px solid ${isExpired ? '#999' : accentColor}; display:flex; justify-content:space-between; align-items:center; box-shadow: 0 4px 12px rgba(0,0,0,0.06);">
                        <div style="flex:1;">
                            <h4 style="margin:0; color:${accentColor}; font-size:1.1rem;">
                                ${isEvent ? '<i class="fas fa-calendar-star"></i> ' : ''}${data.title}
                            </h4>
                            <p style="margin:5px 0; color:#444; font-size:0.9rem;">Broadcast: ${data.targetCode || 'ALL'}</p>
                            ${data.event_date ? `<div style="font-size:0.75rem; color:#e65100; font-weight:bold;"><i class="fas fa-calendar-alt"></i> Event: ${new Date(data.event_date).toLocaleDateString()}</div>` : ''}
                            ${expiryDate ? `
                                <div style="color: ${isExpired ? '#d32f2f' : '#2e7d32'}; font-size: 0.75rem; font-weight: bold; margin-top:5px;">
                                    <i class="fas fa-clock"></i> <span id="time-text-${id}">${isExpired ? 'EXPIRED' : 'Calculating...'}</span>
                                </div>
                            ` : '<div style="font-size:0.7rem; color:#999; margin-top:5px;"><i class="fas fa-infinity"></i> Permanent Notice</div>'}
                        </div>
                        <div style="display:flex; gap:10px;">
                            <button onclick="openEditModal('${id}')" style="background:#e8f5e9; color:#2e7d32; border:none; width:40px; height:40px; border-radius:10px; cursor:pointer;"><i class="fas fa-edit"></i></button>
                            <button onclick="confirmDelete('${id}')" style="background:#ffebee; color:#c62828; border:none; width:40px; height:40px; border-radius:10px; cursor:pointer;"><i class="fas fa-trash-alt"></i></button>
                        </div>
                    </div>`;
                container.innerHTML += card;
                if (expiryDate && !isExpired) startAdminTimer(id, expiryDate);
            });
        });
    } else { 
        window.location.href = "../../index.html"; 
    }
});

function startAdminTimer(id, expiryDate) {
    activeIntervals[id] = setInterval(() => {
        const timeLeft = expiryDate - new Date();
        const timeText = document.getElementById(`time-text-${id}`);
        if (!timeText) return;
        if (timeLeft <= 0) { 
            timeText.innerText = "EXPIRED"; 
            clearInterval(activeIntervals[id]); 
            return; 
        }
        const hours = Math.floor(timeLeft / (1000 * 60 * 60));
        const mins = Math.floor((timeLeft / 1000 / 60) % 60);
        const secs = Math.floor((timeLeft / 1000) % 60);
        timeText.innerText = `${hours}h ${mins}m ${secs}s left`;
    }, 1000);
}

// 4. Open Edit Modal
window.openEditModal = async function(id) {
    try {
        const snap = await getDoc(doc(db, "notices", id));
        if (snap.exists()) {
            const data = snap.data();
            document.getElementById('edit-id').value = id;
            document.getElementById('edit-title').value = data.title;
            document.getElementById('edit-content').value = data.content;
            document.getElementById('edit-target').value = data.targetCode || "ALL";
            
            const eventRow = document.getElementById('edit-event-row');
            const isEvent = data.priority?.toLowerCase().includes('event');
            
            if (isEvent) {
                if(eventRow) eventRow.style.display = 'block';
                document.getElementById('edit-event-date').value = data.event_date || "";
            } else {
                if(eventRow) eventRow.style.display = 'none';
                document.getElementById('edit-event-date').value = ""; 
            }
            
            const preview = document.getElementById('edit-image-preview');
            if(preview) {
                preview.innerHTML = data.attachmentUrl 
                    ? `<p style="font-size:0.8rem; color:#b3004b;"><i class="fas fa-paperclip"></i> Existing Attachment Attached</p>` 
                    : `<p style="font-size:0.75rem; color:#999;">No current attachment</p>`;
            }

            if (data.expiresAt) {
                const date = data.expiresAt.toDate();
                const localISO = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
                document.getElementById('edit-expiry').value = localISO;
            } else { 
                document.getElementById('edit-expiry').value = ""; 
            }
            
            document.getElementById('edit-modal').style.display = 'flex';
        }
    } catch (err) { 
        console.error("Modal Error:", err); 
    }
};

// 5. Save Changes
window.saveEdit = async function() {
    const id = document.getElementById('edit-id').value;
    const title = document.getElementById('edit-title').value;
    const content = document.getElementById('edit-content').value;
    const expiryVal = document.getElementById('edit-expiry').value;
    const eventDate = document.getElementById('edit-event-date').value;
    const fileInput = document.getElementById('edit-file-input');
    const newFile = fileInput ? fileInput.files[0] : null;
    const updateBtn = document.querySelector('[onclick="saveEdit()"]');

    try {
        updateBtn.disabled = true;
        updateBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Updating...`;

        let updateData = {
            title: title,
            content: content,
            event_date: eventDate, 
            updatedAt: serverTimestamp(),
            expiresAt: expiryVal ? Timestamp.fromDate(new Date(expiryVal)) : null
        };

        if (newFile) {
            const attachment = await uploadToCloudinary(newFile);
            if (attachment) {
                updateData.attachmentUrl = attachment.url;
                updateData.attachmentType = attachment.type;
            }
        }

        await updateDoc(doc(db, "notices", id), updateData);
        document.getElementById('edit-modal').style.display = 'none';
        alert("Notice updated successfully!");
    } catch (err) { 
        console.error("Update failed:", err);
        alert("Update failed: " + err.message); 
    } finally {
        updateBtn.disabled = false;
        updateBtn.innerHTML = `<i class="fas fa-check-circle"></i> Update Notice`;
    }
};

// 6. FULLY CORRECTED DELETE FUNCTION
// This handles the real-time removal from Firebase
window.confirmDelete = async function(id) {
    if (!confirm("Are you sure you want to permanently delete this notice? This cannot be undone.")) return;

    try {
        // Target the specific document in the 'notices' collection
        const noticeRef = doc(db, "notices", id);
        
        // Execute the deletion
        await deleteDoc(noticeRef);
        
        // Note: The onSnapshot listener will automatically remove the card from the UI
        console.log(`Notice ${id} deleted successfully from Firestore.`);
        alert("Notice deleted successfully!");
        
    } catch (error) {
        console.error("Error during deletion:", error);
        alert("Error deleting notice: " + error.message);
    }
};