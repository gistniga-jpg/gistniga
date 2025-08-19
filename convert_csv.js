const fs = require('fs');
const path = require('path');

const csvFilePath = path.join(__dirname, 'server', 'brain', '1.csv');
const outputRivePath = path.join(__dirname, 'server', 'brain', '99-from-csv.rive');

console.log(`Reading CSV from: ${csvFilePath}`);

fs.readFile(csvFilePath, 'utf8', (err, data) => {
    if (err) {
        console.error("Error reading the CSV file:", err);
        return;
    }

    const lines = data.trim().split('\n');
    const header = lines.shift(); // Remove header

    let riveScriptContent = '! version = 2.0\n\n';
    let dialoguePairs = 0;

    for (let i = 0; i < lines.length - 1; i++) {
        // Simple CSV split, may not handle all edge cases like commas in quotes
        const currentLine = lines[i].split(',');
        const nextLine = lines[i+1].split(',');

        // Check for basic structure (at least 8 columns)
        if (currentLine.length < 8 || nextLine.length < 8) continue;

        const currentDialogueId = currentLine[0];
        const currentSpeaker = currentLine[6];
        const currentUserUtterance = currentLine[7].trim();

        const nextDialogueId = nextLine[0];
        const nextSpeaker = nextLine[6];
        const nextBotUtterance = nextLine[7].trim();

        // Check if a user turn is followed by a bot turn in the same dialogue
        if (currentDialogueId === nextDialogueId && currentSpeaker === 'user' && nextSpeaker === 'bot') {
            if (currentUserUtterance && nextBotUtterance) {
                // RiveScript triggers can't contain special characters like ?
                const trigger = currentUserUtterance.toLowerCase().replace(/[?.,!]/g, '');
                const reply = nextBotUtterance.replace(/"/g, '');

                riveScriptContent += `+ ${trigger}\n`;
                riveScriptContent += `- ${reply}\n\n`;
                dialoguePairs++;

                // Skip the next line since we've already processed it
                i++;
            }
        }
    }

    fs.writeFile(outputRivePath, riveScriptContent, 'utf8', (writeErr) => {
        if (writeErr) {
            console.error("Error writing the RiveScript file:", writeErr);
            return;
        }
        console.log(`Successfully converted ${dialoguePairs} dialogue pairs.`);
        console.log(`New brain file created at: ${outputRivePath}`);
    });
});
