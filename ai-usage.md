# AI Usage

I used cursor for this project, as I am taking an Applied AI class with Professor Gormanly, and wanted to apply what I was learning in that class.

## Meta-Prompt Process

- For each of the stages, a meta-prompt was made (prompting the AI to make a prompt) that was a plan for carrying out each stage.
- Refining the prompts to be super concise and direct was a big focus of mine. Doing this ensures better output.
- Inputted the grammar in a markdown file to ensure the AI understood the limits of the smaller language and wouldn't exceed scope.

---

## Lexer

- Provided the expected outputs of test examples for the lexer (and later parser and semantic analysis) so the AI had actual direction on how it should be
- Finished step 3 of the first lexer prompt, then refactored the prompt to switch from if statements to a DFA transition table.
- Finished step 4 of the second lexer prompt, but the AI started step 5 without me asking it do so.
- In step 5, the AI referred to `!` as `BANG` — apparently a real term, though surprising to encounter for the first time.
- In step 7, after completing the fourth and fifth lexer tests, the AI output used different token types than the expected output. The provided output treated `I_TYPE` as an id or string, while the AI had them separated.
- In step 9, the AI quickly generated a test suite. In my prior internship, I had to make test suites on my own, and that was a big pain.
- In step 10, switched from Agent mode on GPT 5.4 to Debug mode for a walkthrough/code review. It inserted logging code into the CLI and lexer files, then had commands run against test files to inspect the runtime log. Very cool how the AI can observe this log, and the only bug found was an inconsistency in how `npm start` usage was reported.

---

## Parser

- Converted the provided `treeDemo.js` to `treeDemo.ts`.
- Parser implementation was similar to the lexer, but the steps were compressed since the 10-step lexer process felt like it could have been combined more.
- During step 2 of the parser meta-prompt, the AI automatically generated the test suite without being asked, likely due to a high context window (68.7% at that point).
- After switching to a new agent for the remaining steps, experimented with **Plan Mode**: provided the meta-prompt, told the agent steps 1–2 were complete, and asked it to clarify any questions about the codebase or parsing requirements. It converted steps 3–6 into a build plan, and upon pressing build, switched to Agent mode and finished the parser in about 2–3 minutes.
- Reviewing ~600 lines of code changes was the longest part, but the efficiency as noticed in the previous point was impressive. Furthermore, sing Plan Mode kept context window usage much lower — only at **37.9%** after all was done.
- During final review, discovered `treeDemo.ts` was never actually used, an oversight on my end. Refactored and confirmed everything still worked. A good reminder to actively verify what the AI produces rather than assuming correctness.
- Curious to compare this codebase against classmates' solutions, especially those not using AI tooling, and to see the size difference. The AI may have gone overboard in some areas, but the project works as intended.

---

## Semantic Analysis
- Out of all the phases, this one was the quickest. I had my approach dialed in from doing the lexer and the parser, and I knew how I wanted the Semantic Analysis to be approached. I had the least hiccups in this phase, because as said before, the previous experience of the past two phases were a good northstar for me to follow.
- Pretty funny to me how it refers to your test case from the notes as the "golden input"
- Throughout this project, each and every time it is still so amazing to me how AI in coding has developed from when ChatGPT dropped back in 2022

---

## Code Generation
- Opus 4.7 has dropped at the time of making code generation, and WOW does it eat through my context window extremely quickly. Wondering if that is the same for everyone else or not.
- After making my meta-prompt for code gen, I took a couple days of break to study for exam 2. During that time, GPT-5.5 dropped. 4.7 and 5.5 dropping in the same phase? Funny to me. 
- Out of curiosity of it's strength, I had GPT-5.5 run through my meta-prompt in one shot from Plan mode to build. It asked me if I wanted to follow the prompt step by step, or build the full thing, and also asked about print logic, and I answered to write it into heap memory first, then store the static pointer to the beginning of the string.
- Took a little over 2 minutes, and only 27.2% of my context window... Great efficiency. 23 files changed in the build, and it took a long time to go over them all. Code gen seems to be working great on all the tests it generated, and I tried some form the notes and they worked as expected.

---

## Frontend
- Wanted to make a frontend so when I submit it, you have an easier time actually running test cases compared to using the command line like in the prior commits. Was honestly pretty lazy with the frontend and didn't put much effort into the prompt, just let it do it's thing from plan mode then fed the plan to another agent.