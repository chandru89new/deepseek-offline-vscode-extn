// @ts-ignore
const vscode = acquireVsCodeApi();
const input = document.getElementById("message-input");
const button = document.getElementById("send-button");
const messages = document.getElementById("messages");

const sendMessage = () => {
  // @ts-ignore
  const text = input?.value;
  if (text) {
    if (text?.trim() === "/stop") {
      vscode.postMessage({ text });
      return;
    }
    const messageDiv = document.createElement("div");
    messageDiv.textContent = text;
    messageDiv.classList.add("message");
    messageDiv.classList.add("user-message");
    messages?.appendChild(messageDiv);

    vscode.postMessage({
      text,
      history: (vscode.getState() || { messages: [] })?.messages
    });
    saveUserMessage(text);
    input.innerText = "";
    // @ts-ignore
    input.value = "";
    input.textContent = "";
  }
};

button?.addEventListener("click", sendMessage);
input?.addEventListener("keydown", (e) => {
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
  messages?.appendChild(message);
  // @ts-ignore
  messages.scrollTop = messages.scrollHeight;
  return message;
}

// Restore previous messages
const previousState = vscode.getState() || { messages: [] };
previousState.messages.forEach((msg) => {
  appendMessage(msg.html, msg.className);
});

const saveState = (role) => (msg, text) => {
  const state = vscode.getState() || { messages: [] };
  state.messages.push({
    text: !text || !text?.trim() ? msg : text,
    html: msg,
    role,
    className: getClassnameFromRole(role)
  });
  vscode.setState(state);
};

const getClassnameFromRole = (role) => {
  if (role === "user") {
    return "user-message";
  }
  if (role === "assistant") {
    return "extension-message";
  }
  return "";
};

const saveExtensionMessage = saveState("assistant");
const saveUserMessage = saveState("user");

let markdownText = "";

// listen for messages from the extension
window.addEventListener("message", (event) => {
  const message = event.data; // { command: 'reply', text: 'Hello from extension!' }
  if (message.command === "reply") {
    // Handle the message, e.g., display it
    const messageDiv = document.createElement("div");
    messageDiv.classList.add("extension-message");
    messageDiv.textContent = message.text;
    messages?.appendChild(messageDiv);
    saveExtensionMessage(message?.text, message?.text);
    resetInput();
  }

  if (message.command === "stream-start") {
    markdownText = "";
    currentMessage = appendMessage("", "extension-message");
    input?.setAttribute("placeholder", "Type /stop to stop.");
  }

  if (message.command === "stream-chunk") {
    if (currentMessage) {
      markdownText += message?.text;
      currentMessage.innerHTML = message.html;
      // @ts-ignore
      messages.scrollTop = messages.scrollHeight;
    }
  }

  if (message.command === "stream-end") {
    saveExtensionMessage(currentMessage.innerHTML, markdownText);
    currentMessage = null;
    markdownText = "";
    resetInput();
  }

  if (message.command === "clear-state") {
    vscode.setState({ messages: [] });
    // @ts-ignore
    messages.innerHTML = "";
    // @ts-ignore
    input.focus();
  }
});

const resetInput = () => {
  setTimeout(() => {
    // @ts-ignore
    input.value = "";
    // @ts-ignore
    input.textContent = "";
    // @ts-ignore
    input.innerText = "";
    input?.setAttribute("placeholder", "Type here...");
  }, 10);
};
