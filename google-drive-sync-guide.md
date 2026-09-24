# Google Drive Sync Setup Guide

The application features a robust Google Drive Backup & Sync module, using Google Identity Services (GIS). This guide explains how to get the necessary `Client ID` to make it work.

## 1. Create a Google Cloud Project
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Sign in with your Google account.
3. Click the Project Dropdown at the top (next to the Google Cloud logo) and select **New Project**.
4. Name your project (e.g., `Classroom Drive Sync`) and click **Create**.

## 2. Enable the Google Drive API
1. Once the project is created, select it.
2. Go to **APIs & Services** -> **Library**.
3. Search for **Google Drive API** and click on it.
4. Click **Enable**.

## 3. Configure the OAuth Consent Screen
1. Go to **APIs & Services** -> **OAuth consent screen**.
2. Select **External** (unless you have a Google Workspace organization) and click **Create**.
3. Fill in the App Information:
   - App Name: `Classroom Drive Sync`
   - User Support Email: (Your email)
   - Developer Contact Information: (Your email)
4. Click **Save and Continue**.
5. On the **Scopes** page, click **Add or Remove Scopes**.
   - Search for the exact scope: `https://www.googleapis.com/auth/drive.file`
   - Check the box and click **Update**.
6. Click **Save and Continue**.
7. On the **Test Users** page, add your own Google email address as a test user. (Until you publish the app, only test users can authenticate).
8. Click **Save and Continue**, then return to the Dashboard.

## 4. Generate the OAuth Client ID
1. Go to **APIs & Services** -> **Credentials**.
2. Click **Create Credentials** -> **OAuth client ID**.
3. Select **Web application** as the Application type.
4. Name it (e.g., `Web Client 1`).
5. Under **Authorized JavaScript origins**, click **Add URI** and enter the URLs where your app is hosted (and local testing):
   - `http://localhost:3000`
   - `http://localhost:5000`
   - `https://your-vercel-deployment-url.vercel.app`
   - `https://your-custom-domain.com`
   *(Do NOT include trailing slashes)*
6. Click **Create**.
7. A popup will appear with your **Client ID** (a long string ending in `.apps.googleusercontent.com`). Copy this ID.

## 5. Plug the Client ID into the App
1. Log into your deployed application as an Admin.
2. Go to **Admin Data** -> **Google Drive Sync**.
3. Paste the **Client ID** you copied into the `Google Client ID` field.
4. Enable Auto-Sync.
5. You can now click **Run manual backup now**. A Google popup will appear asking for authorization to save files to your Google Drive!
