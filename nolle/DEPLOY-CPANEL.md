# Putting the shop live on your cPanel hosting

These steps install the shop on your cPanel hosting so it runs at **https://nolleluxuryhair.co.za**.
They take about 15 minutes. Never write your passwords in this file or anywhere in the code.

**Before you start:** in cPanel, look in the *Software* section for **Setup Node.js App**.
If it is not there, ask your host to enable Node.js (version 22.13 or newer) for your account.
The shop needs a Node.js server; plain HTML hosting is not enough for stock, orders and the admin.

## 1. Upload the files

1. In cPanel open **File Manager** and go to your home folder (the folder *above* `public_html`).
2. Create a folder called **`nolle-shop`** and open it.
3. Click **Upload**, choose **`nolle-shop-upload.zip`**, then right-click the zip and choose **Extract**.
   You should now see `server.js`, `package.json`, `lib` and `public` inside `nolle-shop`.

Do **not** put the files inside `public_html`.

## 2. Create the Node.js app

In cPanel open **Setup Node.js App** and click **Create Application**:

| Setting | Value |
| --- | --- |
| Node.js version | **22.x** (22.13 or newer – the shop will not start on 20 or older) |
| Application mode | Production |
| Application root | `nolle-shop` |
| Application URL | `nolleluxuryhair.co.za` |
| Application startup file | `server.js` |

Under **Environment variables**, click **Add Variable** for each of these:

| Name | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `BASE_URL` | `https://nolleluxuryhair.co.za` |
| `DATA_DIR` | `/home/YOUR-CPANEL-USERNAME/nolle-data` (outside `nolle-shop`, so updates never touch orders) |
| `ADMIN_PASSWORD` | a strong password for your shop admin (not your cPanel password) |

Click **Create**, then **Run NPM Install**, then **Restart**.

## 3. Turn on HTTPS

1. cPanel → **SSL/TLS Status** → select `nolleluxuryhair.co.za` and `www.nolleluxuryhair.co.za` → **Run AutoSSL**.
2. cPanel → **Domains** → switch on **Force HTTPS Redirect** for `nolleluxuryhair.co.za`.

## 4. Check it

1. Open https://nolleluxuryhair.co.za and you should see the shop.
2. Open https://nolleluxuryhair.co.za/admin and log in with your `ADMIN_PASSWORD`.
3. In **Settings**, check the WhatsApp number, email, delivery fees and policies.
4. On your phone, open a product, tap **Enquire on WhatsApp**, and check that the message arrives with the product, options, delivery and total.

If the page shows an error, open **Setup Node.js App** → your app → check the Node.js version (22.13+) and press **Restart**.
The error log is in `nolle-shop/stderr.log`.

## Optional: order emails

Create an email account in cPanel (e.g. `orders@nolleluxuryhair.co.za`), then add these environment variables and restart:

| Name | Value |
| --- | --- |
| `SMTP_HOST` | `mail.nolleluxuryhair.co.za` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | `orders@nolleluxuryhair.co.za` |
| `SMTP_PASS` | that email account's password |
| `MAIL_FROM` | `Nolle’ Luxury Hair <orders@nolleluxuryhair.co.za>` |

## Updating the shop later

Upload the new zip into `nolle-shop`, extract it (replace files), then **Restart** the app.
Your products, orders and photos live in `nolle-data`, so they are kept.

## Backups

Download the `nolle-data` folder regularly (File Manager → right-click → Compress → Download),
or include it in cPanel's **Backup**. It holds all products, orders, settings and uploaded photos.
