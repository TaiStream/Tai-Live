# Tai Live

Decentralized live-streaming platform built on Sui and Walrus. Part of the [Tai Network](https://github.com/niccolosottile/Tai-Docs) ecosystem.

## Overview

Tai Live enables creators to broadcast content, earn through multiple on-chain monetization channels, and interact with viewers through prediction markets and tipping — all without centralized intermediaries. Viewers authenticate via zkLogin (Google OAuth), and all payments, reputation, and access tiers live on Sui.

## Architecture

```
Tai-Live/
├── contract/          # Sui Move smart contracts (10 modules, 58 tests)
├── contracts/         # Supplementary contracts (tai_agent for SAI integration)
├── frontend/          # Next.js 16 app (React 19, @mysten/dapp-kit)
├── backend/           # Node.js signaling server + API routes
└── scripts/           # Deployment and verification scripts
```

## Smart Contracts

Located in `contract/sources/`. All modules are published as a single package on Sui testnet.

| Module | Purpose |
|--------|---------|
| `user_profile` | Identity, staking, tier access (FREE/AUDIO/PODCAST/VIDEO/PREMIUM), Proof of Fame / Proof of Effort graduation |
| `content` | Content publishing, on-chain metadata, tier-gated access |
| `reputation` | Cred scoring, jury-based report resolution with quorum, reporting |
| `points` | Soulbound points system with emission caps and multi-action awards |
| `prediction` | Dual-pool prediction markets with platform fee and challenge window |
| `tipping` | Direct peer-to-peer SUI tips with on-chain receipts |
| `room_manager` | Live room creation/joining, connection tracking, host controls |
| `live_stream` | Stream lifecycle, viewer stats, tag management, StreamOwnerCap access control |
| `viewer_session` | Viewer session tracking with registry |
| `payment_distribution` | Revenue splitting (90% streamer / 10% node operator), treasury-based withdrawals |

### Staking Tiers

| Tier | Stake Required | Capabilities |
|------|---------------|--------------|
| FREE | 0 SUI | Watch streams, chat |
| AUDIO | 1 SUI | Audio streaming |
| PODCAST | 10 SUI | Podcast hosting |
| VIDEO | 50 SUI | Video broadcasting |
| PREMIUM | 100 SUI | All features + priority |

Creators can also earn tier access through **Proof of Effort** (engagement-based trial) or **Proof of Fame** (graduation after 6/8 passing weeks).

## Frontend

Next.js 16 application with:

- **Wallet**: Sui wallet connection via `@mysten/dapp-kit`, zkLogin via Enoki + Google OAuth
- **Streaming**: WebRTC P2P mode and relay (WebSocket MSE) mode
- **Predictions**: On-chain prediction markets with real-time odds
- **Tipping**: In-stream micropayments routed through `payment_distribution` treasury
- **Points**: Live points display and award tracking
- **Privacy**: Optional privacy mode via `@tai/p2p-client`

### Key Components

| Component | Path |
|-----------|------|
| Stream page | `src/app/live/stream/[username]/page.tsx` |
| Broadcast page | `src/app/live/broadcast/[roomId]/page.tsx` |
| Dashboard | `src/app/live/dashboard/page.tsx` |
| Prediction widget | `src/components/Prediction/PredictionWidget.tsx` |
| Tip button | `src/components/Tip/TipButton.tsx` |
| Live chat | `src/components/Live/LiveChat.tsx` |
| Stream player | `src/components/Live/StreamPlayer.tsx` |

## Backend

Node.js signaling server for WebRTC peer coordination.

| Route | Purpose |
|-------|---------|
| `/rooms` | Room creation and discovery |
| `/agents` | AI agent session management |
| `/delivery` | Content delivery coordination |
| Signaling WS | WebRTC signaling (offer/answer/ICE) |

## Testnet Deployment

| Resource | ID |
|----------|-----|
| Package (10 modules) | `0x485d8011d546fd82d576b5b60bad253d22f48cf0b5e8f56876d3edebb64b9f62` |
| PointsRegistry | `0x67d1ee884dd7b5c7860630b09bca5eb6a4efdc83823c0177cdd4fb662f2706a5` |
| ReputationRegistry | `0xf92467260dc1963c1d00426801e650edb2f12ef945082a21c070f684e64c9a19` |

## Getting Started

### Prerequisites

- Node.js >= 18
- [Sui CLI](https://docs.sui.io/guides/developer/getting-started/sui-install)
- A Sui wallet with testnet SUI

### Smart Contracts

```bash
cd contract
sui move build
sui move test     # 58 tests across 8 test files
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local   # Fill in your keys (see below)
npm run dev                  # http://localhost:3000
```

### Backend

```bash
cd backend
npm install
npm run dev                  # Signaling on :8080, relay on :8081
```

## Environment Variables

Copy `frontend/.env.example` to `frontend/.env.local` and configure:

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_ENOKI_API_KEY` | Yes | Enoki public API key (sponsored txns) |
| `ENOKI_PRIVATE_API_KEY` | Yes | Enoki private key (server-side) |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Yes | Google OAuth 2.0 client ID (zkLogin) |
| `NEXT_PUBLIC_TAI_PACKAGE_ID` | Yes | Deployed Tai package object ID |
| `NEXT_PUBLIC_POINTS_REGISTRY_ID` | Yes | PointsRegistry shared object ID |
| `NEXT_PUBLIC_REPUTATION_REGISTRY_ID` | Yes | ReputationRegistry shared object ID |
| `NEXT_PUBLIC_TREASURY_ID` | Yes | payment_distribution Treasury object ID |
| `NEXT_PUBLIC_SESSION_REGISTRY_ID` | Yes | viewer_session SessionRegistry object ID |
| `NEXT_PUBLIC_STREAM_REGISTRY_ID` | Yes | live_stream StreamRegistry object ID |

## Testing

```bash
# Smart contracts
cd contract && sui move test

# Frontend unit tests
cd frontend && npm test

# Frontend type check
cd frontend && npx tsc --noEmit
```

## Related Packages

| Package | Description |
|---------|-------------|
| [Tai-Node-Package](../Tai-Node-Package) | Node operator SDK with agent gateway, STT/TTS, relay |
| [Tai-SDK](../Tai-SDK) | Developer SDK for building on Tai |
| [Tai-Meet](../Tai-Meet) | P2P video conferencing |
| [Tai-Docs](../Tai-Docs) | Documentation |

## License

MIT
