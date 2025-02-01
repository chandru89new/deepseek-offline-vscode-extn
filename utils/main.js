const vscode = acquireVsCodeApi();
const input = document.getElementById("message-input");
const button = document.getElementById("send-button");
const messages = document.getElementById("messages");

const sendMessage = () => {
  const text = input.value;
  if (text) {
    if (text?.trim() === "/stop") {
      vscode.postMessage({ text });
      return;
    }
    const messageDiv = document.createElement("div");
    messageDiv.textContent = text;
    messageDiv.classList.add("message");
    messageDiv.classList.add("user-message");
    messages.appendChild(messageDiv);
    saveUserMessage(text);

    vscode.postMessage({ text });
    input.innerText = "";
    input.value = "";
    input.textContent = "";
  }
};

button.addEventListener("click", sendMessage);
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    sendMessage();
  }
});

// autofocus the chat input
if (input) {
  input.focus();
}

// this is used to capture streaming data.
let currentMessage = null;

function appendMessage(text, className) {
  const message = document.createElement("div");
  message.className = "message " + className;
  message.innerHTML = text;
  messages.appendChild(message);
  messages.scrollTop = messages.scrollHeight;
  return message;
}

// Restore previous messages
const previousState = vscode.getState() || { messages: [] };
console.log(previousState);
previousState.messages.forEach((msg) => {
  appendMessage(msg.html, msg.className);
});

const saveState = (className) => (msg) => {
  const state = vscode.getState() || { messages: [] };
  state.messages.push({ html: msg, className });
  vscode.setState(state);
};

const saveExtensionMessage = saveState("extension-message");
const saveUserMessage = saveState("user-message");

let markdownText = "";

// listen for messages from the extension
window.addEventListener("message", (event) => {
  const message = event.data; // { command: 'reply', text: 'Hello from extension!' }
  if (message.command === "reply") {
    // Handle the message, e.g., display it
    const messageDiv = document.createElement("div");
    messageDiv.classList.add("extension-message");
    messageDiv.textContent = message.text;
    messages.appendChild(messageDiv);
    saveExtensionMessage(message?.text);
    resetInput();
  }

  if (message.command === "stream-start") {
    markdownText = "";
    currentMessage = appendMessage("", "extension-message");
    input.setAttribute("placeholder", "Type /stop to stop.");
  }

  if (message.command === "stream-chunk") {
    if (currentMessage) {
      markdownText += message?.text;
      currentMessage.innerHTML = message.html;
      messages.scrollTop = messages.scrollHeight;
    }
  }

  if (message.command === "stream-end") {
    saveExtensionMessage(currentMessage.innerHTML);
    currentMessage = null;
    markdownText = "";
    resetInput();
  }

  if (message.command === "clear-state") {
    vscode.setState({ messages: [] });
    messages.innerHTML = "";
    input.focus();
  }
});

const resetInput = () => {
  setTimeout(() => {
    input.value = "";
    input.textContent = "";
    input.innerText = "";
    input.setAttribute("placeholder", "Type here...");
  }, 10);
};
