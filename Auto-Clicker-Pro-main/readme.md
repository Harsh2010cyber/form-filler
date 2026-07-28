# Auto Clicker Pro 🚀

An advanced and user-friendly Chrome extension designed to automate click sequences with professional features like looping, custom delays, and easy step management.

_(Feel free to replace the link above with a screenshot of your own extension)_

## ✨ Key Features

-   **Easy Step Recording:** Add click coordinates to your sequence with a simple right-click.
-   **Start/Stop Control:** Easily start and stop the click sequence from the popup.
-   **Advanced Looping:**
    -   Run the sequence a specific number of times.
    -   Enable **infinite looping** for continuous automation.
-   **Custom Delays:** Set a unique delay (in milliseconds) for each step to perfectly time your actions.
-   **State Persistence:** The extension remembers if it's running even if you close the popup.
-   **Sleek & Modern UI:** An intuitive interface that is easy to navigate.
-   **Real-time Progress:** A visual progress bar and text counters keep you informed about the current step and loop.
-   **Full Step Management:** Edit delays or delete individual steps on the fly.

## 🛠️ Installation Guide

Since this extension is not on the Chrome Web Store, you need to install it manually in "Developer mode".

1.  **Download the Project:**

    -   Click the green **`< > Code`** button on the GitHub repository page.
    -   Select **Download ZIP**.
    -   Unzip the downloaded file to a location you can easily remember.

2.  **Load the Extension in Chrome:**

    -   Open Google Chrome.
    -   Navigate to the extensions page by typing `chrome://extensions` in your address bar and pressing Enter.
    -   In the top right corner, toggle on the **"Developer mode"** switch.

    -   Three new buttons will appear. Click on the **"Load unpacked"** button.

    -   A file selection window will open. Navigate to the folder where you unzipped the project files and select the **entire folder**.
    -   The **Auto Clicker Pro** extension will now appear in your list of extensions, ready to use!

---

## 📋 How to Use

### 1. Adding a Step

This is the core of the extension. To record a click position:

1.  Go to any webpage.
2.  **Right-click** on the exact spot you want the automated click to happen.
3.  In the context menu that appears, navigate to **🚀 Auto Clicker Pro → ➕ Add Click Step**.
4.  The step will be automatically saved to your sequence. You can see it by opening the extension popup.

### 2. Starting and Stopping the Sequence

-   **To Start:** Open the extension popup and click the green **"Start Sequence"** button. The sequence will begin executing on the current active tab.
-   **To Stop:** While the sequence is running, the button will turn into a red **"Stop Execution"** button. Click it at any time to immediately stop the process.

### 3. Configuring Loops

Before starting the sequence, you can set up looping for repetitive tasks:

1.  Check the **"Enable Looping"** box.
2.  **For a finite loop:** Enter the desired number of repetitions in the **"Loop Count"** field.
3.  **For an infinite loop:** Simply check the **"Infinite Loop"** box. This will override the loop count.

### 4. Managing Individual Steps

Each recorded step in the popup has two action buttons:

-   **✏️ Edit:** Click this to open a modal window where you can change the **delay (in milliseconds)** that occurs _before_ this step is executed.
-   **🗑️ Delete:** Click this to permanently remove the step from your sequence.

### 5. Clearing All Steps

If you want to start fresh, click the **"Clear All"** button at the top of the steps list. A confirmation prompt will appear to prevent accidental deletion.

---

## 🤝 Contributing

Contributions are welcome! If you have ideas for new features or find a bug, feel free to fork the repository, make your changes, and submit a pull request.

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License. See the `LICENSE` file for details.

---

> Developed with ❤️ by **[StackProvider.com](https://www.stackprovider.com)**
