import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  const chatViewProvider = createChatViewProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("chat-view", chatViewProvider),
    vscode.commands.registerCommand("vscode-chat.openChat", () => {
      vscode.commands.executeCommand("workbench.view.extension.chat-sidebar");
    })
  );
}

function createChatViewProvider(
  extensionUri: vscode.Uri
): vscode.WebviewViewProvider {
  return {
    resolveWebviewView: (
      webviewView: vscode.WebviewView,
      context: vscode.WebviewViewResolveContext,
      _token: vscode.CancellationToken
    ) => {
      setupWebview(webviewView, extensionUri);
      handleMessages(webviewView);
    }
  };
}

function setupWebview(
  webviewView: vscode.WebviewView,
  extensionUri: vscode.Uri
): void {
  webviewView.webview.options = {
    enableScripts: true,
    localResourceRoots: [extensionUri]
  };

  webviewView.webview.html = getWebviewHtml();
}

function handleMessages(webviewView: vscode.WebviewView): void {
  webviewView.webview.onDidReceiveMessage((message) => {
    switch (message.command) {
      case "sendMessage":
        vscode.window.showInformationMessage(
          `Message received: ${message.text}`
        );
        break;
    }
  });
}

function getWebviewHtml(): string {
  return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Chat</title>
            <style>
                body {
                    padding: 10px;
                }
                #chat-container {
                    display: flex;
                    flex-direction: column;
                    height: 100vh;
                }
                #messages {
                    flex: 1;
                    overflow-y: auto;
                    margin-bottom: 10px;
                    border: 1px solid var(--vscode-input-border);
                    padding: 10px;
                }
                #input-container {
                    display: flex;
                    gap: 5px;
                }
                #message-input {
                    flex: 1;
                    padding: 5px;
                    background: var(--vscode-input-background);
                    border: 1px solid var(--vscode-input-border);
                    color: var(--vscode-input-foreground);
                }
                button {
                    padding: 5px 10px;
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    cursor: pointer;
                }
                button:hover {
                    background: var(--vscode-button-hoverBackground);
                }
            </style>
        </head>
        <body>
            <div id="chat-container">
                <div id="messages"></div>
                <div id="input-container">
                    <input type="text" id="message-input" placeholder="Type your message...">
                    <button id="send-button">Send</button>
                </div>
            </div>
            <script>
                const vscode = acquireVsCodeApi();
                const messageInput = document.getElementById('message-input');
                const sendButton = document.getElementById('send-button');
                const messagesContainer = document.getElementById('messages');

                const sendMessage = () => {
                    const text = messageInput.value;
                    if (text) {
                        vscode.postMessage({
                            command: 'sendMessage',
                            text: text
                        });
                        
                        const messageElement = document.createElement('div');
                        messageElement.textContent = text;
                        messagesContainer.appendChild(messageElement);
                        
                        messageInput.value = '';
                        messagesContainer.scrollTop = messagesContainer.scrollHeight;
                    }
                };

                sendButton.addEventListener('click', sendMessage);
                messageInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        sendMessage();
                    }
                });
            </script>
        </body>
        </html>
    `;
}
