"use strict";

var Parser = require('tree-sitter');

var JavaScript = require('tree-sitter-javascript'); // Create a Parser instance.


var parser = new Parser();
parser.setLanguage(JavaScript); // Parse some JavaScript code.

var sourceCode = 'function helloWorld() { console.log("Hello, world!"); }';
var tree = parser.parse(sourceCode); // Create a query.

var modifidedScm = "(\n  (comment)* @doc\n  .\n  (method_definition\n    name: (property_identifier) @name) @definition.method\n  (#not-eq? @name \"constructor\")\n  (#strip! @doc \"^[\\s\\*/]+|^[\\s\\*/]$\")\n  (#select-adjacent! @doc @definition.method)\n)\n\n(\n  (comment)* @doc\n  .\n  [\n    (class\n      name: (_) @name)\n    (class_declaration\n      name: (_) @name)\n  ] @definition.class\n  (#strip! @doc \"^[\\s\\*/]+|^[\\s\\*/]$\")\n  (#select-adjacent! @doc @definition.class)\n)\n\n(\n  (comment)* @doc\n  .\n  [\n    (function_expression\n      name: (identifier) @name)\n    (function_declaration\n      name: (identifier) @name)\n    (generator_function\n      name: (identifier) @name)\n    (generator_function_declaration\n      name: (identifier) @name)\n  ] @definition.function\n  (#strip! @doc \"^[\\s\\*/]+|^[\\s\\*/]$\")\n  (#select-adjacent! @doc @definition.function)\n)\n\n(\n  (comment)* @doc\n  .\n  (lexical_declaration\n    (variable_declarator\n      name: (identifier) @name\n      value: [(arrow_function) (function_expression)]) @definition.function)\n  (#strip! @doc \"^[\\s\\*/]+|^[\\s\\*/]$\")\n  (#select-adjacent! @doc @definition.function)\n)\n\n(\n  (comment)* @doc\n  .\n  (variable_declaration\n    (variable_declarator\n      name: (identifier) @name\n      value: [(arrow_function) (function_expression)]) @definition.function)\n  (#strip! @doc \"^[\\s\\*/]+|^[\\s\\*/]$\")\n  (#select-adjacent! @doc @definition.function)\n)\n\n(assignment_expression\n  left: [\n    (identifier) @name\n    (member_expression\n      property: (property_identifier) @name)\n  ]\n  right: [(arrow_function) (function_expression)]\n) @definition.function\n\n(pair\n  key: (property_identifier) @name\n  value: [(arrow_function) (function_expression)]) @definition.function\n\n(\n  (call_expression\n    function: (identifier) @name) @reference.call\n  (#not-match? @name \"^(require)$\")\n)\n\n(call_expression\n  function: (member_expression\n    property: (property_identifier) @name)\n  arguments: (_) @reference.call)\n\n(new_expression\n  constructor: (_) @name) @reference.class\n\n(export_statement value: (assignment_expression left: (identifier) @name right: ([\n (number)\n (string)\n (identifier)\n (undefined)\n (null)\n (new_expression)\n (binary_expression)\n (call_expression)\n]))) @definition.constant\n";
var query = new Parser.Query(JavaScript, Buffer.from(modifidedScm)); // Run the query on the syntax tree.

var matches = query.captures(tree.rootNode);