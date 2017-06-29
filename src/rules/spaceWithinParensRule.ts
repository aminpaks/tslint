/**
 * @license
 * Copyright 2017 Palantir Technologies, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { forEachToken } from "tsutils";

import * as ts from "typescript";
import * as Lint from "../index";

interface Options {
    size: number;
}

export class Rule extends Lint.Rules.AbstractRule {
    /* tslint:disable:object-literal-sort-keys */
    public static metadata: Lint.IRuleMetadata = {
        ruleName: "space-within-parens",
        description: "Enforces spaces within parentheses or disallow them.",
        hasFix: true,
        optionsDescription: Lint.Utils.dedent`
            You may enforce the amount of whitespace within parentheses.
        `,
        options: { type: "number", min: 0 },
        type: "style",
        typescriptOnly: false,
    };
    /* tslint:enable:object-literal-sort-keys */

    public static FAILURE_NO_SPACE = "No whitespace within parentheses";
    public static FAILURE_NEEDS_SPACE = "Needs whitespace within parentheses";
    public static FAILURE_NO_EXTRA_SPACE(count: number): string {
        return `No more than ${count} whitespace within parentheses allowed`;
    }

    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithWalker(new SpaceWhitinParensWalker(sourceFile, this.ruleName, parseOptions(Number(this.ruleArguments[0]))));
    }
}

function parseOptions(whitespaceSize?: number): Options {
    let size = 0;
    if (typeof whitespaceSize === "number") {
        if (whitespaceSize >= 0) {
            size = whitespaceSize;
        }
    } else if (whitespaceSize !== undefined) {
        const parsedSize = parseInt(whitespaceSize, 10);
        if (!Number.isNaN(parsedSize) && parsedSize >= 0) {
            size = parsedSize;
        }
    }
    return {
        size,
    };
}

class SpaceWhitinParensWalker extends Lint.AbstractWalker<Options> {
    public walk(sourceFile: ts.SourceFile) {
        return ts.forEachChild(sourceFile, (node: ts.Node): void => {
            this.checkNode(node);
        });
    }

    private checkNode(node: ts.Node): void {
        forEachToken(node, (token: ts.Node) => {
            if (token.kind === ts.SyntaxKind.OpenParenToken) {
                this.checkOpenParenToken(token);
            } else if (token.kind === ts.SyntaxKind.CloseParenToken) {
                this.checkCloseParenToken(token);
            }
        });
    }

    private checkOpenParenToken(tokenNode: ts.Node) {
        let currentPos = tokenNode.end;
        let currentChar = this.sourceFile.text.charCodeAt(currentPos);
        const allowedSpaceCount = this.options.size;

        while (ts.isWhiteSpaceSingleLine(currentChar)) {
            ++currentPos;
            currentChar = this.sourceFile.text.charCodeAt(currentPos);
        }
        if (!ts.isLineBreak(currentChar)) {
            const whitespaceCount = currentPos - tokenNode.end;
            if (whitespaceCount !== allowedSpaceCount) {
                let length = 0;
                let pos = tokenNode.end;

                if (whitespaceCount > allowedSpaceCount) {
                    pos += allowedSpaceCount;
                    length = whitespaceCount - allowedSpaceCount;
                } else if (whitespaceCount > 0 && whitespaceCount < allowedSpaceCount) {
                    pos += allowedSpaceCount - whitespaceCount;
                }
                this.AddFailureAtWithFix(pos, length, whitespaceCount);
            }
        }
    }

    private checkCloseParenToken(tokenNode: ts.Node) {
        let currentPos = tokenNode.getStart() - 1;
        let currentChar = this.sourceFile.text.charCodeAt(currentPos);
        const allowdSpaceCount = this.options.size;

        while (ts.isWhiteSpaceSingleLine(currentChar)) {
            --currentPos;
            currentChar = this.sourceFile.text.charCodeAt(currentPos);
        }
        /**
         * Number 40 is open parenthese char code, we skip this cause
         * it's already been caught by `checkOpenParenToken`
         */
        if (!ts.isLineBreak(currentChar) && currentChar !== 40) {
            const whitespaceCount = tokenNode.end - tokenNode.pos - 1;
            if (whitespaceCount !== allowdSpaceCount) {
                let length = 0;
                const pos = tokenNode.pos;

                if (whitespaceCount > allowdSpaceCount) {
                    length = whitespaceCount - allowdSpaceCount;
                }
                this.AddFailureAtWithFix(pos, length, whitespaceCount);
            }
        }
    }

    private AddFailureAtWithFix(position: number, length: number, whitespaceCount: number = 0) {
        let lintMsg: string | undefined;
        let lintFix: Lint.Replacement | undefined;
        const allowedSpaceCount = this.options.size;

        if (allowedSpaceCount === 0) {
            lintMsg = Rule.FAILURE_NO_SPACE;
            lintFix = Lint.Replacement.deleteText(position, length);
        } else if (whitespaceCount < allowedSpaceCount) {
            lintMsg = Rule.FAILURE_NEEDS_SPACE;
            let whitespace = "";
            for (let i = 0; i < allowedSpaceCount - whitespaceCount; i++) {
                whitespace += " ";
            }
            lintFix = Lint.Replacement.appendText(position, whitespace);
        } else if (whitespaceCount > allowedSpaceCount) {
            lintMsg = Rule.FAILURE_NO_EXTRA_SPACE(allowedSpaceCount);
            lintFix = Lint.Replacement.deleteText(position, whitespaceCount - allowedSpaceCount);
        }

        if (lintMsg !== undefined) {
            this.addFailureAt(position, length, lintMsg, lintFix);
        }
    }
}
