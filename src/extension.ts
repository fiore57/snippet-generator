import * as vscode from "vscode";
import * as os from "os";
import * as path from "path";
import { readFile, writeFile, open } from "fs";

import * as json from "./json";
import { localeString } from "./localization";

// 選択範囲のテキストを返す
// 選択されていない場合、ファイル全体が返る
function getSelectingText(editor: vscode.TextEditor) {
  const doc = editor.document;
  const curSelection = editor.selection.isEmpty
    ? new vscode.Selection(
        new vscode.Position(0, 0),
        new vscode.Position(doc.lineCount - 1, 10000)
      )
    : editor.selection;
  return doc.getText(curSelection);
}

// コンフィグで設定されたスニペットファイルのパスを得る
function getSnippetFilePath() {
  const conf = vscode.workspace.getConfiguration("generateSnippet");
  let snippetFilePath: string | undefined = conf.get("snippetFilePath");
  if (snippetFilePath === undefined || snippetFilePath === "default") {
    const osName = os.type();
    switch (osName) {
      case "Windows_NT": {
        snippetFilePath = process.env.APPDATA + "\\Code\\User\\snippets\\";
        break;
      }
      case "Linux": {
        snippetFilePath = process.env.HOME + "/.config/Code/User/snippets/";
        break;
      }
      case "Darwin": {
        snippetFilePath =
          process.env.HOME + "/Library/Application Support/Code/User/snippets/";
        break;
      }
      default: {
        snippetFilePath = "";
        break;
      }
    }
  }
  return path.normalize(snippetFilePath);
}

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    "extension.generateSnippet",
    () => {
      const editor = vscode.window.activeTextEditor;
      if (editor === undefined) {
        vscode.window.showErrorMessage(localeString("ts.fileNotFound"));
        return;
      }

      const selectedText = getSelectingText(editor);

      let newSnippet = { language: "", name: "", trigger: "", description: "" };

      vscode.languages
        .getLanguages()
        .then((languages) => {
          // 言語の選択
          return vscode.window.showQuickPick(languages, {
            placeHolder: editor.document.languageId,
          });
        })
        .then((language) => {
          if (language === undefined) return;
          // 言語の処理・スニペット名を入力
          newSnippet.language = language;
          return vscode.window.showInputBox({
            prompt: localeString("ts.enterName"),
            placeHolder: "name",
          });
        })
        .then((name) => {
          if (name === undefined) return;
          if (name === "") {
            vscode.window.showWarningMessage(localeString("ts.emptyName"));
            return;
          }
          // スニペット名の処理・トリガーの入力
          newSnippet.name = name;
          return vscode.window.showInputBox({
            prompt: localeString("ts.enterTrigger"),
            placeHolder: "prefix",
          });
        })
        .then((trigger) => {
          if (trigger === undefined) return;
          if (trigger === "") {
            vscode.window.showWarningMessage(localeString("ts.emptyTrigger"));
            return;
          }
          // トリガーの処理・説明の入力
          newSnippet.trigger = trigger;
          return vscode.window.showInputBox({
            prompt: localeString("ts.enterDescription"),
            placeHolder: "description",
          });
        })
        .then((description) => {
          if (description === undefined) return true;
          // 説明の処理
          newSnippet.description = description;
          return false;
        })
        .then((isCanceled) => {
          if (isCanceled) {
            vscode.window.showInformationMessage(localeString("ts.canceled"));
            return;
          }

          // スニペットファイルのパスを取得
          let snippetFilePath: string = getSnippetFilePath();

          const snippetFileName = newSnippet.language + ".json";
          snippetFilePath += snippetFileName;

          // スニペットの追加処理
          readFile(snippetFilePath, (err, text) => {
            if (err) {
              // ファイルが存在しない場合
              open(snippetFilePath, "w+", (err, _) => {
                if (err) {
                  // スニペットファイルのディレクトリが存在しない（パスが異なる）
                  vscode.window.showErrorMessage(localeString("ts.failed"));
                  return;
                }
                const newSnippetObj: json.SnippetData = {
                  prefix: newSnippet.trigger,
                  body: selectedText,
                  description: newSnippet.description,
                };
                const snippetObjList: json.SnippetDataList = {
                  [newSnippet.name]: newSnippetObj,
                };
                const newJsonText = JSON.stringify(snippetObjList, null, "\t");

                writeFile(snippetFilePath, newJsonText, (_) => {});
                vscode.window.showInformationMessage(
                  localeString("ts.snippetFileLocation") + snippetFilePath
                );
                vscode.window.showInformationMessage(
                  localeString("ts.registered")
                );
                return;
              });
            } else {
              // ファイルが既に存在する場合
              let snippetObjList = json.parseJson(text.toString());

              if (snippetObjList === undefined) {
                // JSONの解析に失敗
                vscode.window.showErrorMessage(
                  localeString("ts.parseError") + snippetFileName
                );
                return;
              }

              const newSnippetObj: json.SnippetData = {
                prefix: newSnippet.trigger,
                body: selectedText,
                description: newSnippet.description,
              };

              if (snippetObjList[newSnippet.name] !== undefined) {
                // 同名のスニペットが存在する
                vscode.window
                  .showWarningMessage(
                    localeString("ts.alreadyExists"),
                    localeString("ts.overwrite"),
                    localeString("ts.cancel")
                  )
                  .then((str) => {
                    if (
                      str === undefined ||
                      str === localeString("ts.cancel")
                    ) {
                      vscode.window.showInformationMessage(
                        localeString("ts.notOverwritten")
                      );
                      return;
                    }
                    snippetObjList![newSnippet.name] = newSnippetObj;

                    const newJsonText = JSON.stringify(
                      snippetObjList,
                      null,
                      "\t"
                    );

                    // Jsonファイルのコメントは消える
                    writeFile(snippetFilePath, newJsonText, (_) => {});
                    vscode.window.showInformationMessage(
                      localeString("ts.overwritten")
                    );
                    return;
                  });
                return;
              }

              const newText = JSON.stringify(newSnippetObj, null, "\t");

              writeFile(
                snippetFilePath,
                json.insertSnippetToJson(newSnippet.name, newText),
                (_) => {}
              );

              vscode.window.showInformationMessage(
                localeString("ts.registered")
              );
              return;
            }
          });
        }); // thenable
    }
  ); // registerCommand

  context.subscriptions.push(disposable);
}

export function deactivate() {}
