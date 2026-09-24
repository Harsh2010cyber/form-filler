# Auto Clicker & Form Filler Pro 🚀

An advanced, user-friendly Chrome extension built for automated form filling and click sequences. It supports filling repeated forms with identical fixed information (Name, Email, Address, Option Selections) while dynamically rotating through unique paragraphs loaded from a `.txt` file, consuming one paragraph per rotation.

---

## ✨ Main Features

### 1. 📄 Dynamic Paragraph Queue (from TXT)
- **1 Paragraph Per Rotation:** On every form submission or rotation loop, the next paragraph from your TXT file is automatically filled into your chosen text box.
- **Auto-Removal / Consumption:** Once a paragraph is used in a rotation, it is consumed and removed from the active queue.
- **Next-Up Live Preview:** Always see which paragraph is queued up for the next rotation, complete with character counts.
- **Save / Export Remaining TXT:** Download the remaining unused paragraphs anytime as an updated `.txt` file with one click!
- **Flexible Import:** Load a `.txt` file via file picker or paste text directly (with support for blank lines or single line paragraph delimiters).

### 2. 🔽 Dropdown & Option Box Selection
- **Custom Dropdowns:** Record clicking the dropdown/select box trigger to open options, and then click on your desired option inside. During playback, the extension automatically waits for the dropdown menu to open and clicks the option item.
- **Native `<select>` Elements:** Automatically detects and records option changes on standard HTML `<select>` tags by option text, value, and index.
- **Framework Compatibility:** Dispatches native input, change, and pointer events compatible with React, Vue, Angular, and vanilla web forms.

### 3. ✍️ Static Form Fields with Same Info
- **Fill Static Fields:** Fill unchanging fields (e.g., Name, Email, Phone, Company, Checkboxes) across every rotation.
- **One-Click Para Box Designation:** In the popup step list (or on the web page), click **📄 Set as Para Box** on any field to convert it from static text to the dynamic paragraph filler.

### 4. ⚡ Sequence & Looping Controls
- **Match TXT Count:** Click **⚡ Match TXT** to instantly set the rotation loop count to the exact number of remaining paragraphs.
- **Custom Delays & Rotation Delay:** Set millisecond delays before individual steps, plus a configurable delay between rotations (to allow form submissions to process).
- **Step Testing & Reordering:** Move steps up (▲) or down (▼) to adjust execution order, and test any single step on the live page with ▶.

---

## 🛠️ Installation Guide

1. Open Google Chrome and go to `chrome://extensions/`.
2. Toggle on **Developer mode** in the top right corner.
3. Click **Load unpacked** in the top left corner.
4. Select this folder (`Auto-Clicker-Pro-main`).
5. Pin the extension to your Chrome toolbar for quick access!

---

## 📋 How to Use (Step-by-Step Guide)

### Step 1: Record Your Form Actions
1. Open the website with the form you wish to fill.
2. Click the extension icon and click **Record** (or press `Ctrl+Shift+R`).
3. On the webpage:
   - Click the dropdown / option box to open it, then click your selected option.
   - Click into text fields (Name, Email, etc.) and type your static text.
   - Click into your message / paragraph box.
   - Click the form's **Submit** button.
4. Press **Esc** or click **Finish** on the floating banner when done.

### Step 2: Designate the Paragraph Box
1. Open the extension popup.
2. In the **Form Steps** list, locate the step for your message or main text area.
3. Click **📄 Set as Para Box**. The step will turn green and display `📄 PARA BOX (Injects TXT Paragraph)`.

### Step 3: Load Your TXT File
1. Under **Paragraph Library**, click **Load TXT** and select your `.txt` file (or click **Paste**).
2. The popup will display the total remaining paragraphs and show a live preview of the paragraph that will be used in Rotation 1.

### Step 4: Run the Automations
1. Under **Loop Sequence**, click **⚡ Match TXT** (or enter your desired number of rotations).
2. Set the **Delay between rotations** (e.g., 2000ms to allow the form to submit).
3. Click **Start Sequence**!
4. Watch the progress bar in real-time. In each rotation:
   - Static fields and option selections are filled.
   - One paragraph is filled into the paragraph box and removed from the library.
5. Once complete, click **Save TXT** if you wish to download any remaining unused paragraphs.

---

## 📄 License
This project is licensed under the MIT License.
