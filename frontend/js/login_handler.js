import { auth, db } from './firebase-config.js';
import { 
    GoogleAuthProvider, 
    signInWithPopup 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc, 
    collection,
    query,
    where,
    getDocs,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

window.loginWithGoogle = async function() {
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        const userEmail = user.email.toLowerCase(); 

        // --- GLOBAL STORAGE (For All Roles) ---
        localStorage.clear(); // Clear old buggy data first
        localStorage.setItem("userPhoto", user.photoURL || ""); 
        localStorage.setItem("userName", user.displayName || "User");
        localStorage.setItem("userEmail", userEmail);
        localStorage.setItem("uid", user.uid); // FIX: Added UID for "Staff UID" display

        // --- STEP 1: ADMIN ROLE ---
        const adminRef = doc(db, "admin", "current_admin");
        const adminSnap = await getDoc(adminRef);

        if (adminSnap.exists()) {
            const adminData = adminSnap.data();
            if (userEmail === adminData.email.toLowerCase()) {
                localStorage.setItem("userRole", "admin");
                localStorage.setItem("userDept", adminData.dept_code || "All");
                window.location.href = `pages/admin/admin_home.html`;
                return;
            }
        }

        // --- STEP 2: STAFF ROLE ---
        const deptQuery = query(
            collection(db, "departments"), 
            where("staffEmails", "array-contains", userEmail)
        );
        
        const deptSnap = await getDocs(deptQuery);

        if (!deptSnap.empty) {
            const deptData = deptSnap.docs[0].data();
            
            localStorage.setItem("userRole", "staff");
            // Use 'userDept' consistently for the profile handler
            localStorage.setItem("userDept", deptData.deptCode); 
            localStorage.setItem("deptName", deptData.deptName);

            window.location.href = "pages/staff/staff_home.html";
            return;
        }

        // --- STEP 3: STUDENT ACCESS ---
        const emailPrefix = userEmail.split('@')[0];
        const isStudentEmail = /^\d/.test(emailPrefix) && userEmail.endsWith("@srcas.ac.in");

        if (isStudentEmail) {
            const studentRef = doc(db, "students", user.uid);
            const studentDoc = await getDoc(studentRef);
            
            const regNumStr = emailPrefix;
            const deptCode = regNumStr.substring(2, 5); 

            if (!studentDoc.exists()) {
                await setDoc(studentRef, {
                    uid: user.uid,
                    name: user.displayName,
                    email: userEmail,
                    regNo: regNumStr, // Consistent with database
                    deptCode: deptCode,
                    batchYear: Number(regNumStr.substring(0, 2)),
                    role: "student",
                    createdAt: serverTimestamp(),
                    lastLogin: serverTimestamp()
                });
            } else {
                await updateDoc(studentRef, { lastLogin: serverTimestamp() });
            }

            localStorage.setItem("userRole", "student");
            localStorage.setItem("userReg", regNumStr); // Maps to 'disp-id' on student profile
            localStorage.setItem("userDept", deptCode);
            window.location.href = "pages/student/student_home.html";
            return;
        }

        alert("Unauthorized access. Email not found in Staff or Admin records.");
        await auth.signOut();
        window.location.reload();

    } catch (error) {
        console.error("Login Error:", error);
        alert("Login Error: " + error.message);
    }
};