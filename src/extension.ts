import * as vscode from 'vscode';
import * as os from 'os'
import * as path from 'path';
import { readFile, writeFile, open } from 'fs';

import * as json from './json';
import { localeString } from './localization';

// 選択範囲のテキストを返す
// 選択されていない場合、ファイル全体が返る
function getSelectingText(editor: vscode.TextEditor) {
	const doc = editor.document;
	const curSelection = (editor.selection.isEmpty ?
		new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(doc.lineCount - 1, 10000)) :
		editor.selection);
	return doc.getText(curSelection);
}

// コンフィグで設定されたスニペットファイルのパスを得る
function getSnippetFilePath() {
	const conf = vscode.workspace.getConfiguration('generateSnippet');
	let snippetFilePath: string | undefined = conf.get('snippetFilePath');
	if (snippetFilePath === undefined || snippetFilePath === 'default') {
		const osName = os.type();
		switch (osName) {
			case ('Windows_NT'): {
				snippetFilePath = process.env.APPDATA + '\\Code\\User\\snippets\\';
				break;
			}
			case ('Linux'): {
				snippetFilePath = process.env.HOME + '/.config/Code/User/snippets/';
				break;
			}
			case ('Darwin'): {
				snippetFilePath = process.env.HOME + '/Library/Application Support/Code/User/snippets/';
				break;
			}
			default: {
				snippetFilePath = '';
				break;
			}
		}
	}
	return path.normalize(snippetFilePath);
}

export function activate(context: vscode.ExtensionContext) {

	const disposable = vscode.commands.registerCommand('extension.generateSnippet', () => {

		const editor = vscode.window.activeTextEditor;
		if (editor === undefined) {
			vscode.window.showErrorMessage(localeString('ts.fileNotFound'));
			return;
		}

		const selectedText = getSelectingText(editor);

		let curSnippet = { language: '', name: '', trigger: '', description: '' };

		vscode.languages.getLanguages()
			.then((languages) => {
				// 言語の選択
				return vscode.window.showQuickPick(
					languages,
					{ placeHolder: editor.document.languageId }
				);

			}).then((language) => {
				if (language === undefined) return;
				// 言語の処理・スニペット名を入力
				curSnippet.language = language;
				return vscode.window.showInputBox({
					prompt: localeString('ts.enterName'),
					placeHolder: 'name'
				});

			}).then((name) => {
				if (name === undefined) return;
				if (name === '') {
					vscode.window.showWarningMessage(localeString('ts.emptyName'));
					return;
				};
				// スニペット名の処理・トリガーの入力
				curSnippet.name = name;
				return vscode.window.showInputBox({
					prompt: localeString("ts.enterTrigger"),
					placeHolder: 'prefix'
				});

			}).then((trigger) => {
				if (trigger === undefined) return;
				if (trigger === '') {
					vscode.window.showWarningMessage(localeString('ts.emptyTrigger'));
					return;
				}
				// トリガーの処理・説明の入力
				curSnippet.trigger = trigger;
				return vscode.window.showInputBox({
					prompt: localeString('ts.enterDescription'),
					placeHolder: 'description'
				});

			}).then((description) => {
				if (description === undefined) return true;
				// 説明の処理
				curSnippet.description = description;
				return false;

			}).then((isCanceled) => {
				if (isCanceled) {
					vscode.window.showInformationMessage(localeString('ts.canceled'));
					return;
				}

				// スニペットファイルのパスを取得
				let snippetFilePath: string = getSnippetFilePath();

				const snippetFileName = curSnippet.language + '.json';
				snippetFilePath += snippetFileName;

				console.log(snippetFilePath);
				// スニペットの追加処理
				readFile(snippetFilePath, (err, text) => {
					if (err) {	// ファイルが存在しない場合
						open(snippetFilePath, 'w+', (err, _) => {
							if (err) {
								// スニペットファイルのディレクトリが存在しない（パスが異なる）
								vscode.window.showErrorMessage(localeString('ts.failed'));
								return;
							}
							const snippet: json.SnippetData = {
								prefix: curSnippet.trigger,
								body: selectedText,
								description: curSnippet.description
							};
							const snippetList: json.SnippetDataList = {
								[curSnippet.name]: snippet
							};
							const newText = JSON.stringify(snippetList, null, '\t');
							writeFile(snippetFilePath, newText, ((_) => { }));
							vscode.window.showInformationMessage(localeString('ts.snippetFileLocation') + snippetFilePath);

							vscode.window.showInformationMessage(localeString('ts.registered'));
							return;
						});
					}
					else {		// ファイルが既に存在する場合
						let snippetList = json.parseJson(text.toString());
						if (snippetList === undefined) {
							// JSONの解析に失敗
							vscode.window.showErrorMessage(localeString('ts.parseError') + snippetFileName);
							return;
						}

						if (snippetList[curSnippet.name] !== undefined) {
							// 同名のスニペットが存在する
							vscode.window.showErrorMessage(localeString('ts.alreadyExists'));
							return;
						}

						const snippet: json.SnippetData = {
							prefix: curSnippet.trigger,
							body: selectedText,
							description: curSnippet.description
						};
						const newText = JSON.stringify(snippet, null, '\t');
						writeFile(snippetFilePath, json.insertSnippetToJson(curSnippet.name, newText), ((_) => { }));

						vscode.window.showInformationMessage(localeString('ts.registered'));
						return;
					}
				});
			});	// thenable
	}); // registerCommand

	context.subscriptions.push(disposable);
}

export function deactivate() { }
