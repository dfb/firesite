# Grammar definition for widget tags. Convert using
# node ../node_modules/nearley/bin/nearleyc widget-grammar.ne > widget-grammar.js
@{%
const moo = require("moo");

const lexer = moo.states({
    main: {
        openBrace : '{',
        closeBrace : '}',
        openBlock : {match:'[[', push:'blockArg'},
        equals : '=',
        quote : {match:'"', push:'simpleArg'},
        identifier : /\w+/,
        ws: { match:/[ \t\n]+/, lineBreaks:true},
    },
    simpleArg: { // a state for parsing a value inside quotes, e.g. foo="<this stuff>"
        quote : {match:'"', pop:1},
        value: { match:/[^"]+/, lineBreaks:true},
    },
    blockArg: { // a state for parsing a value inside double brackets, e.g. foo=[[<this stuff]]
        closeBlock : {match: ']]', pop:1},
        value: {match:/(?:.|[ \t\n])+?(?=\]\])/, lineBreaks:true},
    },
})

%}

@lexer lexer

widget -> _ %openBrace _ %identifier _ arglist _ %closeBrace _ {% d => { return {widget:d[3].value, args:d[5]}} %}

# a widget can have 0 or more args
arglist -> arg:* {% d => d[0] %}

# an arg is a simple arg or a block arg
arg -> simpleArg {% d => d[0] %}
    | blockArg {% d => d[0] %}

# a simple arg is of the form name="value"
simpleArg -> %identifier _ %equals _ %quote %value %quote _ {% d => [d[0].value, d[5].value] %}

# a block arg is of the form name=[[value]]
blockArg -> %identifier _ %equals _ %openBlock %value %closeBlock _ {% d => [d[0].value, d[5].value] %}

_ -> %ws:* {% d => null %}


# an argument is a name=value group

# arg name
# name -> [\w]:+ {% d => d[0].join('') %}

# arg value, in quotes
# value -> "[[" [.]:* "]]" {% d => d[2].join('') %}
#    | "\"" _ [^"]:+? _ "\""  {% d => d[2].join('') %}

# whitespace

