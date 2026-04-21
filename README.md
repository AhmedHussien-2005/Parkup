# ParkUp Web App — Setup Guide

## خطوات الإعداد (اتبعها بالترتيب)

---

## 1️⃣ إنشاء مشروع Firebase

1. افتح https://console.firebase.google.com
2. اضغط **Add project** → اسمه `parkup`
3. اضغط Continue حتى يتم الإنشاء

---

## 2️⃣ إضافة Web App

1. في الصفحة الرئيسية للمشروع اضغط **</>** (Web)
2. App nickname: `parkup-web`
3. اضغط **Register app**
4. **انسخ الـ firebaseConfig** وافتح ملف:
   ```
   js/services/firebase.js
   ```
   والصق القيم بدل الـ placeholders

---

## 3️⃣ تفعيل Authentication

1. Firebase Console → **Authentication** → Get started
2. **Sign-in method** → **Google** → Enable
3. Project public-facing name: `ParkUp`
4. Support email: بريدك
5. اضغط **Save**

---

## 4️⃣ إنشاء Firestore Database

1. Firebase Console → **Firestore Database** → **Create database**
2. اختر **Start in production mode**
3. اختر region قريب (مثلاً `europe-west1`)

### الـ Security Rules (مهم!)
افتح **Rules** tab والصق:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAuth() { return request.auth != null; }
    function role()   { return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.get('role','user'); }

    match /users/{uid}         { allow read: if isAuth(); allow create: if isAuth() && request.auth.uid == uid; allow update: if isAuth() && (request.auth.uid == uid || role() == 'admin'); }
    match /garages/{id}        { allow read: if isAuth(); allow write: if role() == 'admin' || role() == 'owner'; }
    match /street_spots/{id}   { allow read: if isAuth(); allow create: if isAuth(); allow update: if isAuth(); allow delete: if isAuth(); }
    match /points_history/{id} { allow read: if isAuth(); allow create: if isAuth(); }
  }
}
```

اضغط **Publish**

---

## 5️⃣ تفعيل Storage (للصور)

1. Firebase Console → **Storage** → **Get started**
2. Start in production mode

---

## 6️⃣ تشغيل الموقع

**VS Code Live Server (الأسهل):**
- Install extension: "Live Server"
- Right click على `index.html` → Open with Live Server

**أو Python:**
```bash
cd parkup_web
python3 -m http.server 8080
# افتح http://localhost:8080
```

**أو Node:**
```bash
npx serve parkup_web
```

---

## 7️⃣ تحويل نفسك لـ Admin

1. سجل دخول بـ Google
2. افتح Firebase Console → Firestore → collection `users`
3. افتح document بـ UID بتاعك
4. غير حقل `role` من `"user"` لـ `"admin"`
5. Refresh الصفحة — هتشوف Admin Panel

---

## 8️⃣ إضافة جراج (Admin)

من Admin Panel:
1. Garages → **Add Garage**
2. ادخل البيانات
3. لو عايز تربطه بـ Owner، ادخل Firebase UID بتاع الـ owner في حقل "Owner UID"

---

## Project Structure

```
parkup_web/
├── index.html                  ← Splash
├── pages/
│   ├── login.html              ← Google Sign-In
│   └── app.html                ← App shell + sidebar
├── css/theme.css               ← Styles
└── js/
    ├── services/
    │   ├── firebase.js         ← ⚠️ ضيف config هنا
    │   ├── app.js              ← Firebase init (shared)
    │   ├── auth.js             ← Authentication
    │   └── db.js               ← Firestore operations
    ├── components/ui.js        ← Toast, Modal, helpers
    └── screens/
        ├── map.js              ← خريطة (User)
        ├── list.js             ← قايمة (User)
        ├── points.js           ← نقاط (User)
        ├── profile.js          ← Profile (User)
        ├── admin.js            ← Admin panel
        └── owner.js            ← Owner dashboard
```
