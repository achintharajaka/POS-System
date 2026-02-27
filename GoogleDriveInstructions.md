# How to set up Google Drive Sync

Welcome! You are just a few steps away from enabling automatic Google Drive backups for your POS system. To make this work, the system needs permission to upload files to your Google account. Because this is your own private system, you need to generate your own "keys" to unlock this feature. 

Don't worry, it's very easy! Just follow these steps like a recipe.

---

### Step 1: Open the Google Cloud Console
1. Go to this website: [Google Cloud Console](https://console.cloud.google.com/)
2. Sign in with the Google Account where you want to save your backups.
3. Once logged in, look at the top-left near the logo. If it's your first time, it might ask you to agree to some Terms of Service. Accept them.

### Step 2: Create a New Project
1. Look for a dropdown menu at the top of the screen that usually says "Select a project" (or might have the name of an existing project). Click it.
2. A small window will appear. Click **New Project** in the top-right corner of that window.
3. Give your project a name, like "POS System Backup" and click **Create**.
4. Wait a few seconds for Google to build it. You'll see a notification when it's ready. Make sure your new project is selected at the top of the screen.

### Step 3: Turn on the Google Drive API
For your system to talk to Google Drive, we need to turn on the connection.
1. In the search bar at the very top of the page, type **Google Drive API** and press Enter.
2. Click on the result that says "Google Drive API".
3. Click the big blue **Enable** button. Wait a few moments for it to load.

### Step 4: Make an "OAuth Consent Screen"
This is what users (you) will see when granting permission to the system to access Drive.
1. On the left side of the screen, find the menu and click **OAuth consent screen**.
2. Under "User Type", select **External** and then click **Create**.
3. Now, fill in the required boxes:
   * **App name:** Type something like "POS Backup".
   * **User support email:** Select your email address from the dropdown.
   * Scroll all the way to the bottom to **Developer contact information** and type your email address again.
4. Click **Save and Continue** at the bottom.
5. It will ask about "Scopes". Don't worry about this right now. Just scroll down and click **Save and Continue** again.
6. It will ask for "Test users". Click **+ Add Users** and type in your own Gmail address (that you'll use to login to the system). Click **Add**, then scroll down and click **Save and Continue**.
7. Scroll to the bottom and click **Back to Dashboard**.

### Step 5: Get your Keys!
Now for the final pieces: the Client ID and the API Key.

**A. Get your Client ID:**
1. On the left-side menu, click **Credentials**.
2. At the top of the screen, click **+ CREATE CREDENTIALS** and choose **OAuth client ID**.
3. Under "Application type", select **Web application**.
4. Under "Name", type whatever you want (e.g., "Web Client").
5. Scroll down to **Authorized JavaScript origins**. Click **+ ADD URI**.
   * *Important:* You need to type the URL where you run your POS system. For example, if you run it locally on your computer, you might type `http://localhost` or `http://127.0.0.1`. If you uploaded it to a website, type that website address (e.g., `https://my-pos-system.com`).
6. Click the blue **Create** button at the bottom.
7. A popup will appear showing your **Client ID**. Copy this long string of letters and numbers!

**B. Get your API Key:**
1. Now that the popup is closed, click **+ CREATE CREDENTIALS** at the top of the screen again.
2. This time, choose **API key**.
3. A popup will instantly appear showing your new **API key**. Copy this text too!

---

### Step 6: Put the Keys in your Code
1. Open your POS project folder on your computer.
2. Go to the `js` folder, then open the `modules` folder.
3. Find the file called `drive-sync.js` and open it in Notepad (or any code editor).
4. At the very top of the file, you will see two lines that look like this:
   ```javascript
   const CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID_HERE'; 
   const API_KEY = 'YOUR_GOOGLE_API_KEY_HERE';
   ```
5. Replace `'YOUR_GOOGLE_CLIENT_ID_HERE'` with the Client ID you copied (keep the quotes!).
6. Replace `'YOUR_GOOGLE_API_KEY_HERE'` with the API Key you copied (keep the quotes!).
7. Save the file.

**That's it! You're done!** 
Refresh your POS system in the browser, go to Settings, and click "Login & Sync to Google Drive." It should now pop up a Google login screen asking for your permission.
