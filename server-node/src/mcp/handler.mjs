import { McpServer } from '@modelcontextprotocol/server';
import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';

import oauth from '../services/oauth.service.js';
import userRepository from '../repositories/user.repository.js';

const RESOURCE_PATH = '/mcp';

function publicBaseUrl(req) {
  const configured = String(process.env.MCP_PUBLIC_URL || '').trim();
  if (configured) return configured.replace(/\/$/, '');
  const protocol = req.get('x-forwarded-proto') || req.protocol || 'http';
  return `${protocol}://${req.get('host')}`;
}

function protectedResourceMetadataUrl(req) {
  return `${publicBaseUrl(req)}/.well-known/oauth-protected-resource/mcp`;
}

export function sendMcpAuthChallenge(req, res, error = null) {
  const metadataUrl = protectedResourceMetadataUrl(req);
  const parameters = [
    'Bearer',
    error ? `error="${error}"` : null,
    `resource_metadata="${metadataUrl}"`,
  ].filter(Boolean).join(' ');

  res.set('WWW-Authenticate', parameters);
  res.status(401).json({
    jsonrpc: '2.0',
    error: {
      code: -32001,
      message: 'OAuth bearer authentication is required to access PlacePrep MCP.',
    },
    id: null,
  });
}

/**
 * Creates the PlacePrep MCP server instance.
 *
 * PHASE 2 BOUNDARY:
 * The MCP server is strictly closed-by-default.
 * No domain tools and no MCP Apps are registered in this phase.
 * The endpoint exists solely to verify OAuth 2.1 authentication,
 * token audience binding, and user context derivation.
 */
function createConfiguredServer() {
  return new McpServer({
    name: 'PlacePrep MCP',
    version: '0.1.0',
  });
}

export async function handleMcpRequest(req, res) {
  const authorization = String(req.get('authorization') || '');
  if (!authorization.startsWith('Bearer ')) {
    sendMcpAuthChallenge(req, res);
    return;
  }

  const token = authorization.slice(7).trim();
  const baseUrl = publicBaseUrl(req);
  const expectedResource = `${baseUrl}${RESOURCE_PATH}`;

  const principal = await oauth.principal(token, expectedResource);
  if (!principal) {
    sendMcpAuthChallenge(req, res, 'invalid_token');
    return;
  }

  const user = await userRepository.findById(principal.userId);
  if (!user) {
    sendMcpAuthChallenge(req, res, 'invalid_token');
    return;
  }

  req.mcpPrincipal = principal;
  req.mcpUser = user;

  await handleAuthenticatedMcpRequest(req, res, user, baseUrl);
}

export async function handleAuthenticatedMcpRequest(req, res) {
  const server = createConfiguredServer();
  const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined });

  res.on('close', () => {
    void transport.close();
    void server.close();
  });

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}

export function getMcpResourcePath() {
  return RESOURCE_PATH;
}
