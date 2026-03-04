import { db } from './firebase-config.js';
import { 
    collection, query, where, orderBy, onSnapshot, doc, getDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const noticeContainer = document.getElementById('notice-container');
const userEmail = localStorage.getItem("userEmail");
const rawId = localStorage.getItem("userReg") || ""; 
const studentRegNum = Number(rawId); 

async function startFeed() {
    let myDept = "";
    let myClass = "";
    let activeTargets = [];

    // --- 1. GET PROFILE DATA ---
    try {
        if (userEmail) {
            const userSnap = await getDoc(doc(db, "users", userEmail.toLowerCase().trim()));
            if (userSnap.exists()) {
                const userData = userSnap.data();
                myDept = userData.dept_code || "";
                myClass = userData.batch || "";
            }
        }
    } catch (e) { console.error("Profile fetch error:", e); }

    // --- 2. FALLBACK TARGETS ---
    if (rawId.length >= 8) {
        const year = rawId.substring(0, 2);
        const dept = rawId.substring(2, 5);
        if (!myClass) activeTargets.push(`${dept}_${year}_Batch_UG-S1`, `${dept}_${year}_Batch_UG-S2`);
        else activeTargets.push(myClass);
        if (!myDept) myDept = dept;
    }

    // --- 3. APPLY FILTERS ---
    const urlParams = new URLSearchParams(window.location.search);
    const filterType = urlParams.get('filter'); 
    if (filterType === "OFFICIAL") activeTargets = ["ALL"];
    else if (filterType === "DEPT") activeTargets = [myDept];
    activeTargets = activeTargets.filter(t => t && t !== "");

    // --- 4. THE QUERY ---
    const q = query(
        collection(db, "notices"),
        where("targetCode", "in", activeTargets),
        orderBy("createdAt", "desc")
    );

    // --- 5. LISTENER ---
    onSnapshot(q, (snapshot) => {
        if (!noticeContainer) return;
        noticeContainer.innerHTML = ''; 
        
        if (snapshot.empty) {
            noticeContainer.innerHTML = `<p style="text-align:center; padding:40px; color:#999;">No notices found.</p>`;
            return;
        }

        let lastProcessedDate = ""; 
        const now = new Date();
        const twoDaysFromNow = new Date();
        twoDaysFromNow.setDate(now.getDate() + 2);

        snapshot.forEach((docSnap) => {
            const notice = docSnap.data();
            const id = docSnap.id;

            // Range Check
            const start = Number(notice.start_reg);
            const end = Number(notice.end_reg);
            if (start && end && (studentRegNum < start || studentRegNum > end)) return;

            // --- EXACT COLOR LOGIC FROM ADMIN CN ---
            const adminRed = "#d32f2f";
            const pinOrange = "#ff9800";
            const staffBlue = "#1a237e";

            let isPinned = false;
            if (notice.event_date) {
                const eventDate = new Date(notice.event_date);
                // Pin if event is within the next 2 days
                if (eventDate <= twoDaysFromNow && eventDate >= now.setHours(0,0,0,0)) {
                    isPinned = true;
                }
            }

            // Determine Primary Color
            let accentColor = staffBlue; // Default
            if (isPinned || (notice.priority && notice.priority.toLowerCase().includes('event'))) {
                accentColor = pinOrange;
            } else if (notice.authorRole === "admin") {
                accentColor = adminRed;
            }

            // --- DATE SEPARATOR ---
            const createdAt = notice.createdAt?.toDate ? notice.createdAt.toDate() : new Date(notice.createdAt);
            const dateStr = createdAt.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '-') 
                             + " " + createdAt.toLocaleDateString('en-US', { weekday: 'long' });

            if (dateStr !== lastProcessedDate) {
                noticeContainer.innerHTML += `
                    <div style="width: 100%; border-top: 2px solid #333; margin: 30px 0 15px; position: relative; clear: both;">
                        <span style="position: absolute; top: -14px; left: 10px; background: #f0f2f5; padding: 0 12px; font-weight: 800; color: #333; font-size: 0.9rem;">
                            ${dateStr}
                        </span>
                    </div>`;
                lastProcessedDate = dateStr;
            }

            const timeOnly = createdAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });

            // --- RENDER CARD ---
            noticeContainer.innerHTML += `
                <div class="notice-card" onclick="showNoticePopup('${id}')" 
                     style="background:white; padding:20px; border-radius:18px; margin-bottom:15px; 
                     border-left:8px solid ${accentColor}; box-shadow: 0 8px 20px rgba(0,0,0,0.06); border: 1px solid #f0f0f0; position:relative;">
                    
                    ${isPinned ? `<div style="position:absolute; top:-10px; right:15px; background:${pinOrange}; color:white; font-size:0.6rem; padding:2px 8px; border-radius:4px; font-weight:bold; box-shadow:0 2px 5px rgba(0,0,0,0.1);"><i class="fas fa-thumbtack"></i> UPCOMING</div>` : ''}

                    <div style="display:flex; justify-content:space-between; align-items:start;">
                        <h3 style="font-weight:900; color:${accentColor}; font-size:1.15rem; margin:0; text-transform: capitalize;">
                            <i class="fas ${notice.event_date ? 'fa-calendar-star' : (notice.authorRole === 'admin' ? 'fa-shield-alt' : 'fa-info-circle')}"></i> 
                            ${notice.title}
                        </h3>
                    </div>

                    ${notice.event_date ? `
                        <div style="color:${pinOrange}; font-size:0.85rem; font-weight:bold; margin-top:8px;">
                            <i class="fas fa-calendar-day"></i> Event Date: ${new Date(notice.event_date).toLocaleDateString()}
                        </div>
                    ` : ''}
                    
                    <p style="color:#444; font-size:0.95rem; line-height:1.5; margin:15px 0;">
                        ${notice.content}
                    </p>
                    
                    <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #f5f5f5; padding-top:12px;">
                        <div style="font-size:0.75rem; color:#888;">
                            <i class="fas ${notice.authorRole === 'admin' ? 'fa-user-shield' : 'fa-user-circle'}"></i> 
                            <b style="color:#555;">${notice.authorName || 'Official'}</b> 
                            <span>• ${timeOnly}</span>
                        </div>
                        <span style="background:${accentColor}; color:white; padding:2px 10px; border-radius:6px; font-size:0.65rem; font-weight:bold; text-transform:uppercase;">
                            ${notice.priority || 'NORMAL'}
                        </span>
                    </div>
                </div>`;
        });
    });
}

// --- POPUP LOGIC FOR STUDENT FEED ---
window.showNoticePopup = async function(id) {
    // 1. Fetch the specific notice data
    const docSnap = await getDoc(doc(db, "notices", id));
    if (!docSnap.exists()) return;
    const notice = docSnap.data();

    // 2. Create Overlay
    const overlay = document.createElement('div');
    overlay.id = "notice-overlay";
    overlay.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); display:flex; align-items:center; justify-content:center; z-index:10000; padding:20px; backdrop-filter: blur(8px);";

    // 3. Handle Links and Media
    const linkedContent = notice.content.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color:#1a237e; font-weight:bold; text-decoration:underline;">$1</a>');
    
    let mediaHtml = "";
    const items = notice.attachments || [];
    if (items.length === 0 && notice.attachmentUrl) {
        items.push({ url: notice.attachmentUrl, type: notice.attachmentType });
    }

    if (items.length > 0) {
        mediaHtml = `
            <div style="margin-top:20px; display:flex; overflow-x:auto; gap:10px; padding-bottom:10px; scroll-snap-type: x mandatory;">
                ${items.map(item => {
                    if (item.type === 'image') return `<div style="flex:0 0 100%; scroll-snap-align:center;"><img src="${item.url}" style="width:100%; border-radius:15px; max-height:300px; object-fit:cover;"></div>`;
                    if (item.type === 'video') return `<div style="flex:0 0 100%; scroll-snap-align:center;"><video controls style="width:100%; border-radius:15px;"><source src="${item.url}"></video></div>`;
                    return `<div style="flex:0 0 100%; scroll-snap-align:center;"><a href="${item.url}" target="_blank" style="display:flex; flex-direction:column; align-items:center; padding:30px; background:#f0f2f5; border-radius:15px; text-decoration:none; color:#1a237e;"><i class="fas fa-file-pdf" style="font-size:2rem;"></i><span>View Document</span></a></div>`;
                }).join('')}
            </div>`;
    }

    // 4. Construct Popup UI
    overlay.innerHTML = `
        <div style="background:white; width:100%; max-width:500px; border-radius:25px; overflow:hidden; position:relative; box-shadow:0 20px 50px rgba(0,0,0,0.3);">
            <div style="padding:20px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;">
                <h2 style="margin:0; font-size:1.1rem; color:#333;">${notice.title}</h2>
                <button onclick="document.getElementById('notice-overlay').remove()" style="border:none; background:#eee; width:30px; height:30px; border-radius:50%; cursor:pointer;">&times;</button>
            </div>
            <div style="padding:20px; max-height:70vh; overflow-y:auto;">
                <p style="white-space:pre-wrap; color:#444; line-height:1.6;">${linkedContent}</p>
                ${mediaHtml}
            </div>
            <div style="padding:15px 20px; background:#f9f9f9; font-size:0.75rem; color:#888; border-top:1px solid #eee;">
                Posted by <b>${notice.authorName}</b> • ${notice.targetCode}
            </div>
        </div>`;

    document.body.appendChild(overlay);

    // 5. Record View (Optional but recommended)
    try {
        const studentId = localStorage.getItem("userReg") || "Guest";
        const studentName = localStorage.getItem("userName") || "Student";
        const { setDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        await setDoc(doc(db, "notices", id, "views", studentId), {
            viewerName: studentName,
            viewedAt: serverTimestamp()
        }, { merge: true });
    } catch(e) { console.error("View record failed", e); }
};

// --- 6. SYNC ONESIGNAL TAGS ---
if (window.OneSignalDeferred) {
    OneSignalDeferred.push(async function(OneSignal) {
        if (myDept) {
            await OneSignal.User.addTag("dept_code", myDept);
            console.log("OneSignal: Tagged with Dept", myDept);
        }
    });
}


startFeed();