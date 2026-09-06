@echo off
REM Launch the teetime MCP server from a fixed working directory.
REM Some MCP clients (Claude Desktop on Windows) spawn servers in system32 and
REM ignore the config's `cwd`, which breaks `npm run mcp` and the `@/` path alias.
REM %~dp0 is this file's own directory, so this works no matter where it's called from.
cd /d "%~dp0.."
node "node_modules\tsx\dist\cli.mjs" "src\mcp\server.ts"
