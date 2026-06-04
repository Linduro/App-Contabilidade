export const reputationSbtAbi = [
  {
    type: "function",
    name: "getReputationScore",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "averageScaled", type: "uint256" },
      { name: "total", type: "uint256" },
    ],
    stateMutability: "view",
  },
] as const

export const credentialNftAbi = [
  {
    type: "function",
    name: "getCredentialsByRecipient",
    inputs: [{ name: "recipient", type: "address" }],
    outputs: [
      {
        type: "tuple[]",
        components: [
          { name: "tokenId", type: "uint256" },
          { name: "recipient", type: "address" },
          { name: "credentialType", type: "string" },
          { name: "institution", type: "string" },
          { name: "title", type: "string" },
          { name: "issueDate", type: "uint256" },
          { name: "expiryDate", type: "uint256" },
          { name: "metadataURI", type: "string" },
          { name: "revoked", type: "bool" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "verifyCredential",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      { name: "isValid", type: "bool" },
      {
        name: "credential",
        type: "tuple",
        components: [
          { name: "tokenId", type: "uint256" },
          { name: "recipient", type: "address" },
          { name: "credentialType", type: "string" },
          { name: "institution", type: "string" },
          { name: "title", type: "string" },
          { name: "issueDate", type: "uint256" },
          { name: "expiryDate", type: "uint256" },
          { name: "metadataURI", type: "string" },
          { name: "revoked", type: "bool" },
        ],
      },
    ],
    stateMutability: "view",
  },
] as const

export const serviceEscrowAbi = [
  {
    type: "function",
    name: "getServicesByProvider",
    inputs: [{ name: "provider", type: "address" }],
    outputs: [
      {
        type: "tuple[]",
        components: [
          { name: "id", type: "uint256" },
          { name: "provider", type: "address" },
          { name: "client", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "status", type: "uint8" },
          { name: "title", type: "string" },
          { name: "description", type: "string" },
          { name: "createdAt", type: "uint256" },
          { name: "deadline", type: "uint256" },
          { name: "clientApproved", type: "bool" },
          { name: "hasDispute", type: "bool" },
        ],
      },
    ],
    stateMutability: "view",
  },
] as const
