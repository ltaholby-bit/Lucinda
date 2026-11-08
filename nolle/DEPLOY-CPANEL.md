# Putting the shop live on your cPanel hosting

These steps install the shop on your cPanel hosting so it runs at **https://nolleluxuryhair.co.za**.
They take about 15 minutes. Never write your passwords in this file or anywhere in the code.

**Before you start:** in cPanel, look in the *Software* section for **Setup Node.js App**.
(It may be called **Node.js**.) If it is not there, ask your host to enable Node.js (version 22.13 or newer) for your account.
The shop needs a Node.js server; plain HTML hosting is not enough for stock, orders and the admin.

## 1. Create the Node.js app

In cPanel open **Setup Node.js App** (or **Node.js**) and click **Create Application**:

| Setting | Value |
| --- | --- |
| Node.js version | **22.13 or newer** (e.g. 24 or 26) – the shop will not start on 20 or older |
| Application mode | Production |
| Application root | `nolle-shop` |
| Application URL | `nolleluxuryhair.co.za` (leave the box next to it empty) |
| Application startup file | `server.js` |
| Passenger log file | `/home/YOUR-CPANEL-USERNAME/logs/nolle-shop.log` |

Click **Create**. Then, on the app's page under **Environment variables**, click **Add Variable** for each of these and **Save**
(`NODE_ENV` is set automatically by Production mode):

| Name | Value |
| --- | --- |
| `BASE_URL` | `https://nolleluxuryhair.co.za` |
| `DATA_DIR` | `/home/YOUR-CPANEL-USERNAME/nolle-data` (outside `nolle-shop`, so updates never touch orders) |
| `ADMIN_PASSWORD` | a strong password for your shop admin (not your cPanel password) |

## 2. Upload the files

1. In cPanel open **File Manager** and open the **`nolle-shop`** folder (cPanel created it in your home folder).
2. Click **Upload**, choose **`nolle-shop-upload.zip`**, then right-click the zip and choose **Extract**.
   If cPanel put a sample `server.js` there, choose to **replace** existing files.
   You should now see `server.js`, `package.json`, `lib` and `public` inside `nolle-shop`.

Do **not** put the files inside `public_html`.

Back in **Setup Node.js App**, open the app, click **Run NPM Install**, wait for it to finish, then click **Restart**.

## 3. Turn on HTTPS

1. cPanel → **SSL/TLS Status** → select `nolleluxuryhair.co.za` and `www.nolleluxuryhair.co.za` → **Run AutoSSL**.
2. cPanel → **Domains** → switch on **Force HTTPS Redirect** for `nolleluxuryhair.co.za`.

## 4. Check it

1. Open https://nolleluxuryhair.co.za and you should see the shop.
2. Open https://nolleluxuryhair.co.za/admin and log in with your `ADMIN_PASSWORD`.
3. In **Settings**, check the WhatsApp number, email, delivery fees and policies.
4. On your phone, open a product, tap **Confirm My Pre-Order on WhatsApp**, and check that the message arrives with the product, options, delivery and total.

If the page shows an error, open **Setup Node.js App** → your app → check the Node.js version (22.13+) and press **Restart**.
The error log is the Passenger log file you chose (e.g. `logs/nolle-shop.log`) or `nolle-shop/stderr.log`.

## Optional: order emails

Create an email account in cPanel (e.g. `orders@nolleluxuryhair.co.za`), then add these environment variables and restart:

| Name | Value |
| --- | --- |
| `SMTP_HOST` | `mail.nolleluxuryhair.co.za` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | `orders@nolleluxuryhair.co.za` |
| `SMTP_PASS` | that email account's password |
| `MAIL_FROM` | `Nolle’ Luxury Hair <orders@nolleluxuryhair.co.za>` |

## Test a complete online order (payment, confirmation, tracking)

While everything is pre-order, clients order on WhatsApp and the online checkout is not used. Before you sell
ready-to-ship stock online, test the whole journey once on your phone:

1. Admin → **Products** → open one product → set **Availability** to *Ready to ship*, give one option **stock 1**, Save.
2. On your phone, open that product → **Add to cart** → **Checkout**. Enter your own details, choose **PEP PAXI** or **Courier**,
   check the delivery fee and total, choose **EFT**, and place the order.
3. Check the confirmation page: order reference (NLH-…), **Awaiting payment**, payment deadline, “Get bank details on WhatsApp”.
   If order emails are set up, check the confirmation email too.
4. Admin → **Orders** → open the order → **Mark as paid**. Refresh the client’s order page: it shows *Paid – being prepared*.
5. Enter a test tracking number → **Mark as dispatched**. The client’s order page shows the tracking number; use the
   “WhatsApp tracking to client” button to see the message.
6. Clean up: **Cancel order & return stock**, then set the product back to *Pre-order* (or keep it ready to ship if it is real stock).

## Updating the shop later

1. Download a backup of `nolle-data` first (see Backups below).
2. Upload the new zip into `nolle-shop`, extract it and choose to **replace** existing files.
3. In **Setup Node.js App**, open the app and click **Restart**.

Your products, orders, settings and photos live in `nolle-data`, so they are kept. Any one-time updates to them run
automatically when the shop restarts, and never overwrite text you have edited in the admin.

## Backups

Download the `nolle-data` folder regularly (File Manager → right-click → Compress → Download),
or include it in cPanel's **Backup**. It holds all products, orders, settings and uploaded photos.
