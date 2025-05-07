export function parseCustomJSON(jsonString) {
  try {
    if (typeof jsonString === 'string') {
      // Handle ObjectId and other custom types
      const parsedJSON = jsonString.replace(/new ObjectId\("([^"]+)"\)/g, (match, id) => {
        return JSON.stringify({ $oid: id });
      });
      return JSON.parse(parsedJSON);
    }
    return jsonString;
  } catch (error) {
    console.error('Error parsing JSON:', error);
    return null;
  }
}

export function formatJSON(editor) {
  try {
    const content = editor.getValue();
    const parsed = JSON.parse(content);
    editor.setValue(JSON.stringify(parsed, null, 2));
  } catch (error) {
    console.error('Error formatting JSON:', error);
  }
}

export function syntaxHighlight(json) {
  if (typeof json !== 'string') {
    json = JSON.stringify(json, null, 2);
  }
  return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
    let cls = 'json-number';
    if (/^"/.test(match)) {
      if (/:$/.test(match)) {
        cls = 'json-key';
        // Remove the colon from the key
        match = match.slice(0, -1);
      } else {
        cls = 'json-string';
      }
    } else if (/true|false/.test(match)) {
      cls = 'json-boolean';
    } else if (/null/.test(match)) {
      cls = 'json-null';
    }
    
    // Escape HTML special characters
    match = match.replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
    
    return `<span class="${cls}">${match}</span>`;
  })
  // Add color to brackets and commas
  .replace(/[{}\[\]]/g, match => `<span class="json-bracket">${match}</span>`)
  .replace(/,/g, '<span class="json-comma">,</span>');
} 