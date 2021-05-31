// Generated automatically by nearley, version 2.20.1
// http://github.com/Hardmath123/nearley
(function () {
function id(x) { return x[0]; }

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

var grammar = {
    Lexer: lexer,
    ParserRules: [
    {"name": "widget", "symbols": ["_", (lexer.has("openBrace") ? {type: "openBrace"} : openBrace), "_", (lexer.has("identifier") ? {type: "identifier"} : identifier), "_", "arglist", "_", (lexer.has("closeBrace") ? {type: "closeBrace"} : closeBrace), "_"], "postprocess": d => { return {widget:d[3].value, args:d[5]}}},
    {"name": "arglist$ebnf$1", "symbols": []},
    {"name": "arglist$ebnf$1", "symbols": ["arglist$ebnf$1", "arg"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "arglist", "symbols": ["arglist$ebnf$1"], "postprocess": d => d[0]},
    {"name": "arg", "symbols": ["simpleArg"], "postprocess": d => d[0]},
    {"name": "arg", "symbols": ["blockArg"], "postprocess": d => d[0]},
    {"name": "simpleArg", "symbols": [(lexer.has("identifier") ? {type: "identifier"} : identifier), "_", (lexer.has("equals") ? {type: "equals"} : equals), "_", (lexer.has("quote") ? {type: "quote"} : quote), (lexer.has("value") ? {type: "value"} : value), (lexer.has("quote") ? {type: "quote"} : quote), "_"], "postprocess": d => [d[0].value, d[5].value]},
    {"name": "blockArg", "symbols": [(lexer.has("identifier") ? {type: "identifier"} : identifier), "_", (lexer.has("equals") ? {type: "equals"} : equals), "_", (lexer.has("openBlock") ? {type: "openBlock"} : openBlock), (lexer.has("value") ? {type: "value"} : value), (lexer.has("closeBlock") ? {type: "closeBlock"} : closeBlock), "_"], "postprocess": d => [d[0].value, d[5].value]},
    {"name": "_$ebnf$1", "symbols": []},
    {"name": "_$ebnf$1", "symbols": ["_$ebnf$1", (lexer.has("ws") ? {type: "ws"} : ws)], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "_", "symbols": ["_$ebnf$1"], "postprocess": d => null}
]
  , ParserStart: "widget"
}
if (typeof module !== 'undefined'&& typeof module.exports !== 'undefined') {
   module.exports = grammar;
} else {
   window.grammar = grammar;
}
})();
