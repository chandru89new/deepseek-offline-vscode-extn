import * as vscode from "vscode";
import ollama from "ollama";
import { marked } from "marked";
import hljs from "highlight.js";

const renderer = new marked.Renderer();
renderer.code = ({ text, lang }) => {
  const highlighted =
    lang && hljs.getLanguage(lang)
      ? hljs.highlight(text, { language: lang }).value
      : text;

  return `<pre><code class="hljs language-${
    lang || ""
  }">${highlighted}</code></pre>`;
};

marked.setOptions({
  renderer,
  gfm: true
});

let markdownText = "";
let currentWebviewView: vscode.WebviewView | null = null;

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("ddoc-chat-view", {
      resolveWebviewView(webviewView) {
        currentWebviewView = webviewView;

        // Get path to script in extension directory
        const mainJs = webviewView.webview.asWebviewUri(
          vscode.Uri.joinPath(context.extensionUri, "utils", "main.js")
        );
        // Enable scripts in the webview
        webviewView.webview.options = {
          enableScripts: true,
          // Allow loading resources from extension directory
          localResourceRoots: [
            vscode.Uri.joinPath(context.extensionUri, "utils")
          ]
        };
        webviewView.webview.html = /*html*/ `
            <!DOCTYPE html>
            <html>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
            <style>
            .think {
              opacity: 0.5;
              border-left: 1px solid var(--vscode-input-border);
              padding-left: 0.6rem;
              margin-bottom: 1rem;
            }
            .think::before {
              display: block;
              content: 'Thinking...';
              opacity: 0.5;
              margin-bottom: 0.5rem;
            }
            body {
                margin: 0;
                padding: 0;
                height: 100vh;
                display: flex;
                flex-direction: column;
                color: var(--vscode-foreground);
                line-height: 1.75;
            }
            p {
              margin: 0;
              padding: 0;
            }
            p + * {
              margin-top: 1rem;
            }
            #messages {
                flex: 1;
                overflow-y: auto;
                padding: 1rem;
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
            }
            .user-message {
                padding: 0.5rem 0.75rem;
                border-radius: 0.25rem;
                align-self: flex-end;
                background: var(--vscode-textLink-activeForeground);
                color: var(--vscode-button-foreground);
                max-width: 85%;
            }
            .extension-message {
                max-width: 100%;
                align-self: flex-start;
            }
            #input-container {
                border-top: 1px solid var(--vscode-input-border);
                padding: 1rem;
                display: flex;
                gap: 0.5rem;
            }
            #message-input {
                flex: 1;
                padding: 0.5rem;
                border: 1px solid var(--vscode-input-border);
                background: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
                border-radius: 0.25rem;
            }
            #message-input:focus {
                outline: 1px solid var(--vscode-focusBorder);
                border-color: transparent;
            }
            #send-button {
                padding: 0.5rem 1rem;
                background: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                border-radius: 0.25rem;
                cursor: pointer;
            }
            #send-button:hover {
                background: var(--vscode-button-hoverBackground);
            }
            pre {
              background: var(--vscode-textPreformat-background);
              padding: 0.5rem;
              border-radius: 5px;
              font-size: 0.9em;
              white-space: pre-wrap;
            }
            pre code {
              background: transparent;
            }
            code:not(pre code) {
              background: var(--vscode-textPreformat-background);
              font-size: 0.9em;
            }
        </style>
            <body>
            <div id="messages"></div>
            <div id="input-container">
                <textarea type="text" id="message-input" placeholder="Type here..."></textarea>
                <button id="send-button">Send</button>
            </div>
            <script src="${mainJs}"></script>
            </body>
            </html>
        `;

        webviewView.webview.onDidReceiveMessage(async (message) => {
          try {
            if (message.text === "/stop") {
              ollama.abort();
              return;
            }
            const previousMessages = formatMsgForDS(message.history);

            const stream = await ollama.chat({
              model: "deepseek-r1",
              stream: true,
              messages: [
                ...previousMessages,
                { role: "user", content: message.text }
              ]
            });
            webviewView.webview.postMessage({
              command: "stream-start"
            });
            let accumulatedText = "";
            for await (const chunk of stream) {
              accumulatedText += chunk?.message?.content;
              webviewView.webview.postMessage({
                command: "stream-chunk",
                text: chunk?.message?.content,
                html: marked(replaceThinkWithBlockquote(accumulatedText))
              });
            }
            webviewView.webview.postMessage({
              command: "stream-end"
            });
            accumulatedText = "";
          } catch (e: any) {
            webviewView.webview.postMessage({
              command: "reply",
              text: "Could not process the request. " + e?.message
            });
          }
        });
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("deepseek-offline.openChat", () => {
      vscode.commands.executeCommand("workbench.view.extension.chat-sidebar");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("deepseek-offline.clearChat", () => {
      if (currentWebviewView) {
        currentWebviewView.webview.postMessage({ command: "clear-state" });
      }
    })
  );
}

const replaceThinkWithBlockquote = (content: string) => {
  return content
    .replaceAll("<think>", "<div class='think'>")
    .replaceAll("</think>", "</div>");
};

const formatMsgForDS = (
  history: Array<{ text: string; role: string }> = []
) => {
  return history.map((item) => {
    return { role: item?.role, content: item?.text };
  });
};
