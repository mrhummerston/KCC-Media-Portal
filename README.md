# Media Equipment Loans Portal: online version

This runs on your own free Cloudflare account, using your GitHub account. It updates live on every device, and you don't need Claude.

The folder you downloaded contains:

| Item | What it's for |
|---|---|
| `public/` | The web page (`index.html`) and two small helper files for the QR codes |
| `functions/api/[[path]].js` | The behind-the-scenes part that saves loans and checks the teacher password |
| `README.md` | This guide |

It takes about 15 minutes. Cloudflare sometimes renames its buttons, so if a label is slightly different, look for the closest match.

---

## Part A: Put the files on GitHub (3 minutes)

1. Go to **github.com** and click **+**, then **New repository**.
2. Name it `kcc-media-loans`, choose **Private**, and click **Create repository**.
3. On the new empty repository, click **uploading an existing file**.
4. Unzip the download. Drag the **`functions`** folder, the **`public`** folder and **`README.md`** onto the page, then click **Commit changes**.
5. Check the repository now shows `functions/api/[[path]].js` and `public/index.html`. The folders need to be kept, not just the files inside them.

## Part B: Make the database (2 minutes)

6. Go to **dash.cloudflare.com** and sign in.
7. In the left menu open **Storage & Databases**, then **D1 SQL Database**, then **Create**.
8. Name it `kcc-media-loans` and click **Create**. That's all. The tables and your full inventory are set up automatically the first time the site runs.

## Part C: Publish the site (10 minutes)

9. In the left menu open **Workers & Pages**, then click **Create** (or **Create application**).
10. Choose the **Pages** option, then **Connect to Git** (it may say "Import an existing Git repository").
11. Allow Cloudflare to see your GitHub, pick **kcc-media-loans**, and click **Begin setup**.
12. Fill in the build settings:
    - **Framework preset:** None
    - **Build command:** leave empty
    - **Build output directory:** `public`
13. Click **Save and Deploy**. When it finishes, the page may show a "database not connected" message. That's expected, and the next steps fix it.
14. Open the project's **Settings**, then **Bindings**, then **Add**, then **D1 database**.
    - **Variable name:** `DB` (capital letters)
    - **D1 database:** `kcc-media-loans`
    - Click **Save**.
15. Still in **Settings**, open **Variables and Secrets** and click **Add**.
    - **Type:** Secret
    - **Name:** `TEACHER_CODE`
    - **Value:** `333`
    - Click **Save**.
16. Go to **Deployments**. On the latest one, click the **⋯** menu and choose **Retry deployment**. Settings only take effect on a new deployment.
17. Open your site at **https://kcc-media-loans.pages.dev** (the exact address is shown at the top of the project). Tap **Teacher** and enter **333**.

You're live.

---

## Who can use it

- **Students** open the link to borrow and to tick what they've brought back. They can't open the Teacher tab, can't confirm returns, can't change the inventory, and can't see anyone's email address. Those checks happen on Cloudflare, not just on the page.
- **Teachers** enter the password once per device. Give the other teacher the link and the password.
- **To make the whole site teacher-only**, so students can't open anything without the password, go to **Settings**, then **Variables and Secrets**, add a **Text** variable named `STUDENT_ACCESS` with the value `off`, then **Retry deployment** as in step 16. You'd then make bookings for students yourself.

## QR stickers

- **Print:** Teacher tab, then **QR stickers**, then **Print QR stickers**. It prints one sticker per numbered kit, handycam, GoPro and numbered microphone, plus one per item type for everything else. Print the "everything else" page more than once if you need a sticker on every tripod or cable. A4 sticker paper is easiest, or plain paper and clear tape.
- **Scan:** Return gear, then open the student, then **📷 Scan returns**. Allow the camera, then hold each item's sticker up to it. A beep and a green flash mean it's ticked. When everything's scanned, tap **Done**, then **Mark as returned**.

## Everyday jobs

- **Change the password:** **Settings**, then **Variables and Secrets**, then edit `TEACHER_CODE`, then **Retry deployment**. Everyone re-enters the new password.
- **Add or change gear:** Teacher tab, then **Inventory**. Changes are live straight away.
- **Backups:** Teacher tab, then **Backup and records**, then **Download backup**, once a term.
- **Bring over loans from the single-file version:** in the old file, Teacher, then **Download backup**. On the new site, Teacher, then **Restore from backup**, and pick that file.
- **Change a file:** edit it on GitHub, or upload a new version. Cloudflare republishes automatically within a minute or two.

## Good to know

- **Cost:** Cloudflare's free plan easily covers a school media room.
- **Updates:** devices check for changes every 5 seconds, so a booking on one iPad shows up on your laptop almost straight away.
- **Camera access:** the camera works because the site uses `https://`. If scanning says the camera is blocked, allow camera access for the site in the browser's settings.
- **If something goes wrong:** in Cloudflare, open the project, then **Deployments**, then the latest deployment, then **Functions**, then **Real-time logs**, and reload the page to see the error. The most common causes are the binding not being named exactly `DB`, or forgetting to **Retry deployment** after adding settings.
