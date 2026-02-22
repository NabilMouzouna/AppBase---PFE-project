# LocalCloud — Project Specification

**Self-hosted cloud platform for local networks (storage, IAM, developer APIs)**

---

## 1. Project Overview

### 1.1 Scope

LocalCloud (or HomeStack) is an **infrastructure platform**, not a consumer application. It provides:

- **Storage layer** — S3-compatible object storage on external drives
- **IAM system** — identity and access control
- **API layer** — REST APIs for third-party applications
- **Multi-tenancy** — isolated users and permissions
- **Security isolation** — operates exclusively on external/removable drives

**Tagline:** *"AWS for your LAN — Self-hosted cloud platform with storage, IAM, and developer APIs"*

**Key Security Design:** The server operates exclusively on user-specified external drives (USB, external HDD/SSD). It has **no access** to the host machine's internal files, system directories, or configurations. The server process runs with restricted permissions, confined to designated external storage paths. Even if compromised, only the external drive contents are exposed — your host machine remains protected.

### 1.2 Positioning

| Type | Description |
|------|-------------|
| ❌ Consumer app | Simple file sharing |
| ✅ Platform | Infrastructure and developer tooling (APIs, IAM, storage abstraction) |

Phasing: LAN-first deployment, with optional WAN extension later.

---

## 2. Value Proposition

### 2.1 End Users

- Access files from any device on the LAN
- No recurring subscription (vs. e.g. Google Drive at ~$10/month for 2TB)
- Data stays on the network; no off-site transfer
- Usable without internet connectivity
- **Host machine security** — server only accesses external drives

### 2.2 Developers

- S3-compatible API for LAN-based applications
- Authentication and authorization as a service
- Local-first application development target

### 2.3 Organizations (schools, clinics, SMBs)

- Enterprise-style features at lower cost
- Data residency and compliance-friendly deployment
- High transfer speeds over LAN
- Full control over infrastructure
- **Incident isolation** — compromised server cannot access internal systems

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENT LAYER                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Web UI     │  │  Mobile App  │  │  Developer Apps  │  │
│  │  (Console)   │  │  (Optional)  │  │  (via SDK/API)   │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────────┘  │
└─────────┼──────────────────┼──────────────────┼─────────────┘
          │                  │                  │
          │         LAN (192.168.x.x)          │
          │                  │                  │
┌─────────▼──────────────────▼──────────────────▼─────────────┐
│                   API GATEWAY LAYER                          │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  HTTPS/TLS Termination + Request Routing            │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │    │
│  │  │ Auth API │  │ Storage  │  │   Admin API      │  │    │
│  │  │ Endpoint │  │   API    │  │   (IAM/Users)    │  │    │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────────────┘  │    │
│  └───────┼─────────────┼──────────────┼────────────────┘    │
└──────────┼─────────────┼──────────────┼─────────────────────┘
           │             │              │
┌──────────▼─────────────▼──────────────▼─────────────────────┐
│                   SERVICE LAYER                              │
│  ┌──────────────────┐  ┌──────────────────┐                 │
│  │  Identity & IAM  │  │  Storage Service │                 │
│  │  ───────────────  │  │  ───────────────  │                 │
│  │  • Users         │  │  • Buckets       │                 │
│  │  • Roles         │  │  • Objects       │                 │
│  │  • Policies      │  │  • Multipart     │                 │
│  │  • JWT Tokens    │  │  • Encryption    │                 │
│  └────────┬─────────┘  └────────┬─────────┘                 │
│           │                     │                            │
│  ┌────────▼─────────────────────▼─────────┐                 │
│  │         Metadata Store                 │                 │
│  │  ┌──────────────┐  ┌─────────────────┐ │                 │
│  │  │  PostgreSQL  │  │   Redis Cache   │ │                 │
│  │  │(on ext drive)│  │   (Sessions)    │ │                 │
│  │  └──────────────┘  └─────────────────┘ │                 │
│  └────────────────────────────────────────┘                 │
└──────────────────────────┬───────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────┐
│                   STORAGE LAYER                              │
│  ┌───────────────────────────────────────────────────────┐   │
│  │            Object Storage Engine                      │   │
│  │  ┌─────────────────┐  ┌──────────────────────────┐   │   │
│  │  │  Encryption     │  │  Chunking & Deduplication│   │   │
│  │  │  (AES-256-GCM)  │  │  (Content Addressing)    │   │   │
│  │  └────────┬────────┘  └──────────┬───────────────┘   │   │
│  └───────────┼────────────────────────┼──────────────────┘   │
└──────────────┼────────────────────────┼──────────────────────┘
               │                        │
        ┌──────▼────────────────────────▼──────┐
        │  EXTERNAL DRIVE (USB/HDD/SSD)        │
        │  ┌──────────┐  ┌───────────────┐    │
        │  │ Objects  │  │ Database +    │    │
        │  │ Storage  │  │ Config + Logs │    │
        │  └──────────┘  └───────────────┘    │
        └──────────────────────────────────────┘
                 ↑
                 │ Isolated Access Only
                 │ (No host filesystem access)
```

### 3.1 Security Isolation Model

**Filesystem Restrictions:**
- Server runs with restricted user privileges (non-admin/non-root)
- Only read/write access to designated external drive paths
- Zero access to: system directories (`/`, `C:\`, `/home`, `/etc`), internal drives, user documents, application configs

**Configuration:**
```yaml
storage:
  allowed_paths:
    - /mnt/external-drive-1      # Linux USB mount
    - /media/usb-storage          # Alternative mount
    - E:\                         # Windows external drive
  # All other paths blocked with access denied error
```

**Path Validation (enforced in code):**
```go
func validatePath(requestedPath string) error {
    realPath := filepath.Clean(requestedPath)
    
    // Check if path starts with allowed directories
    for _, allowed := range config.AllowedPaths {
        if strings.HasPrefix(realPath, allowed) {
            return nil
        }
    }
    return errors.New("access denied: path outside allowed storage")
}
```

**External Drive Detection:**
- Automatic scanning for USB/removable drives only
- Manual path specification during setup
- System drives automatically excluded from detection

**Complete Isolation:**
- Database stored on external drive
- Configuration files on external drive
- Logs written to external drive
- Zero writes to host filesystem

**Security Result:**
- ✅ Compromised server → external drive only exposed
- ✅ Host OS files protected
- ✅ User documents protected
- ✅ System configurations protected
- ✅ Principle of least privilege enforced

---

## 4. Core Components

### 4.1 API Gateway

- Single entry point for all requests
- Routing to auth, storage, and admin services
- Rate limiting and request logging
- TLS termination

### 4.2 Identity & IAM

**Users & authentication**

- Registration and login
- JWT issuance and validation
- Password reset flows

**Roles & policies**

- Roles (e.g. Admin, Developer, ReadOnly)
- Policies attached to roles
- Policy format (example):

```json
{
  "Version": "1.0",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["storage:GetObject", "storage:PutObject"],
    "Resource": "bucket:my-photos/*"
  }]
}
```

**Access keys**

- API key pairs (access key + secret) for programmatic access
- Keys bound to user identity; used for Storage API calls

### 4.3 Storage Service (S3-Compatible)

**Buckets**

- Logical containers; per-bucket permissions; optional versioning

**Objects**

- Arbitrary file types; metadata (content-type, custom headers); multipart upload for large files

**API surface (S3-compatible subset)**

```
# Bucket operations
PUT    /{bucket}                    # Create bucket
GET    /{bucket}                    # List objects
DELETE /{bucket}                    # Delete bucket

# Object operations
PUT    /{bucket}/{key}              # Upload object
GET    /{bucket}/{key}              # Download object
DELETE /{bucket}/{key}              # Delete object
HEAD   /{bucket}/{key}              # Get metadata

# Multipart uploads
POST   /{bucket}/{key}?uploads      # Initiate
PUT    /{bucket}/{key}?uploadId=X   # Upload part
POST   /{bucket}/{key}?uploadId=X   # Complete
```

### 4.4 Storage Engine

- **Encryption at rest:** AES-256-GCM; master key + per-object keys; keys in metadata DB, encrypted with master key
- **Content addressing (optional):** content hash (e.g. SHA-256); deduplication by storing one copy per hash
- **Physical layout:** objects as files under external drive directory structure; metadata (name, size, owner, encryption key) in the database

---

## 5. Resource Management

### 5.1 Host Machine Protection

The server is designed to run as a **background service** that uses host resources (CPU, RAM, network) without interfering with normal computer usage.

**Resource Limits (Configurable):**
```yaml
resources:
  max_cpu_percent: 70          # Never use more than 70% CPU
  max_memory_mb: 2048          # Max 2GB RAM
  max_concurrent_uploads: 10   # Limit parallel operations
  max_concurrent_downloads: 20
  disk_io_limit_mbps: 100      # Throttle disk I/O
```

**Implementation:**
- Worker pools limit concurrent operations
- Rate limiting on API requests
- Stream files (no full-file memory loading)
- Buffered I/O for disk operations
- Lower process priority (OS-level nice/priority settings)
- Auto-throttle when host resources exceed thresholds

**Why It Works on Weak Hardware:**
- File transfers are **I/O-bound**, not CPU-bound (minimal computation)
- Encryption overhead is only 5-10% CPU (modern CPUs have AES instructions)
- Network saturates before CPU does (100 Mbps LAN = ~20% CPU on old hardware)
- Go's efficient goroutines (2KB each vs 1MB threads)

**Minimum Viable Hardware:**
- CPU: Dual-core (even older Celeron/i3)
- RAM: 2GB total (1GB for server + OS)
- Any HDD/SSD (speed affects transfer rate, not feasibility)

**Real-World Performance:**
An old laptop (i5 4th gen, 4GB RAM) can handle:
- 30+ concurrent users
- 100+ Mbps transfers
- Host still usable for browsing/documents

---

## 6. Functional Requirements

### 6.1 Identity & Access Management

**FR1.1 — User management**

- CRUD for users
- Email + password authentication
- Optional email verification
- Password reset (email or manual)

**FR1.2 — Role-based access control**

- Predefined roles: SuperAdmin, Admin, Developer, User
- Custom roles; role assignment to users; optional role inheritance

**FR1.3 — Policy management**

- JSON-based policies (AWS IAM–style)
- Policies attached to roles
- Policy evaluation (allow/deny for given action/resource)

**FR1.4 — API keys**

- Access key + secret key pairs; revocation; keys bound to user; used for programmatic access

### 6.2 Storage Service

**FR2.1 — Buckets**

- Create/delete buckets; list buckets (scoped by access); bucket-level permissions; optional quotas

**FR2.2 — Objects**

- Upload (single and multipart), download, delete; list with pagination; metadata (content-type, size, last-modified)

**FR2.3 — Encryption**

- Encryption at rest; transparent to callers; optional client-side encryption (user-supplied key)

**FR2.4 — Access control**

- Object-level permissions; pre-signed URLs; public vs private objects

### 6.3 Admin Console (Web UI)

**FR3.1 — Dashboard**

- Storage usage (global, per user, per bucket); active users; recent activity

**FR3.2 — User management**

- Add/remove users; assign roles; view user activity

**FR3.3 — Storage browser**

- Browse buckets/objects; upload/download via UI; delete

**FR3.4 — System configuration**

- **External drive selection/detection**; quotas; encryption keys; system logs

### 6.4 Developer SDK (Optional)

**FR4.1 — Python SDK (example)**

```python
from localcloud import Client

client = Client(
    endpoint='http://192.168.1.100:8080',
    access_key='AKIAIOSFODNN7EXAMPLE',
    secret_key='wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'
)

client.upload_file('my-bucket', 'photo.jpg', '/path/to/photo.jpg')
client.download_file('my-bucket', 'photo.jpg', '/path/to/save.jpg')
objects = client.list_objects('my-bucket')
```

---

## 7. Non-Functional Requirements

| ID   | Area   | Target |
|------|--------|--------|
| NFR1 | Performance | 50+ concurrent connections; 80%+ of LAN bandwidth for transfer; API latency &lt;100 ms (excl. transfer); files up to 50 GB (multipart) |
| NFR2 | Security | AES-256 at rest; TLS 1.3 in transit; bcrypt/Argon2 for passwords; API secrets not logged; audit logging; **filesystem isolation** |
| NFR3 | Scalability | 1000+ users; 10 TB+ storage; stateless API layer for horizontal scaling |
| NFR4 | Reliability | Graceful handling of drive issues; DB backup/restore; crash recovery |
| NFR5 | Resource efficiency | &lt;2GB RAM usage; &lt;70% CPU utilization; minimal host impact |
| NFR6 | Developer experience | S3-compatible API; OpenAPI/Swagger; SDK examples (e.g. Python/JS); standard HTTP status codes |

---

## 8. Technology Stack

### 8.1 Backend — Go

- Single-binary deployment; strong fit for APIs and concurrency; low resource use; cross-platform (Windows, Linux, macOS)
- **Suggested:** Gin or Fiber (HTTP); GORM (ORM); golang-jwt; bcrypt; Go crypto (AES-GCM). MinIO design can be used as reference for S3 compatibility.

### 8.2 Database — PostgreSQL

- Relational model; JSON/JSONB for policies; production-ready. SQLite is an alternative for minimal deployment.
- **Location:** Stored on external drive, not host system

### 8.3 Cache — Redis (optional)

- Sessions, rate limiting, temporary tokens.

### 8.4 Frontend — React

- Component-based; large ecosystem. Suggested: Ant Design or Material-UI; React Router; Axios; React Dropzone for uploads.

### 8.5 Documentation

- Swagger/OpenAPI generated from code.

---

## 9. Implementation Plan (3 Months)

### Month 1 — Core infrastructure (weeks 1–4)

**Weeks 1–2:** Project layout; PostgreSQL schema (users, roles, policies); registration/login; JWT issue/validation; basic web UI (login/signup); **external drive detection and path validation**.

**Weeks 3–4:** Roles and assignment; policy schema and evaluation; API key generation; admin UI for users and roles.

**Milestone:** Users, roles, and API keys operational; external drive isolation working.

### Month 2 — Storage (weeks 5–8)

**Weeks 5–6:** Bucket create/delete; single-file upload/download/delete; on-disk storage with encryption; metadata in DB.

**Weeks 7–8:** Multipart upload; list with pagination; pre-signed URLs; quotas; IAM checks on storage operations.

**Milestone:** S3-like API working and integrated with IAM.

### Month 3 — Polish and demo (weeks 9–12)

**Week 9:** Dashboard (metrics, activity); storage browser; log viewer; **resource monitoring**.

**Week 10:** Python SDK (basic); example app; Swagger/OpenAPI docs.

**Week 11:** Load testing (~50 concurrent users); permission and security checks; encryption verification; error handling; **host isolation testing**.

**Week 12:** Installation guide; user and architecture docs; demo scenarios (multi-user, developer SDK, IAM, performance, **security isolation**).

---

## 10. Database Schema (Core)

```sql
-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- Roles
CREATE TABLE roles (
    id UUID PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP
);

-- Policies (attached to roles)
CREATE TABLE policies (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    policy_document JSONB NOT NULL,
    created_at TIMESTAMP
);

-- Role-Policy mapping
CREATE TABLE role_policies (
    role_id UUID REFERENCES roles(id),
    policy_id UUID REFERENCES policies(id),
    PRIMARY KEY (role_id, policy_id)
);

-- User-Role mapping
CREATE TABLE user_roles (
    user_id UUID REFERENCES users(id),
    role_id UUID REFERENCES roles(id),
    PRIMARY KEY (user_id, role_id)
);

-- API Keys
CREATE TABLE api_keys (
    access_key VARCHAR(100) PRIMARY KEY,
    secret_key_hash VARCHAR(255) NOT NULL,
    user_id UUID REFERENCES users(id),
    created_at TIMESTAMP,
    last_used_at TIMESTAMP
);

-- Buckets
CREATE TABLE buckets (
    id UUID PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    owner_id UUID REFERENCES users(id),
    quota_bytes BIGINT,
    created_at TIMESTAMP
);

-- Objects
CREATE TABLE objects (
    id UUID PRIMARY KEY,
    bucket_id UUID REFERENCES buckets(id),
    key VARCHAR(1024) NOT NULL,
    size_bytes BIGINT,
    content_type VARCHAR(100),
    encryption_key VARCHAR(255),
    storage_path VARCHAR(1024),
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    UNIQUE(bucket_id, key)
);

-- Audit Logs
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    action VARCHAR(100),
    resource VARCHAR(500),
    result VARCHAR(50),
    timestamp TIMESTAMP
);
```

---

## 11. Demo and Evaluation Criteria

The following can be demonstrated for a defense or evaluation:

1. **Multi-user:** Three users (Admin, Teacher, Student); Teacher uploads to a "lectures" bucket; Student can download but not upload; Admin manages users and sees all buckets.
2. **Developer:** Python script using the SDK to upload many files without using the web UI.
3. **Security:** Objects encrypted on disk (raw file unreadable); unauthorized access returns 403; audit log of actions; **attempt to access host filesystem results in denial**.
4. **Performance:** Large upload (e.g. 1 GB) with measured throughput; multiple concurrent downloads; **host machine remains responsive**.
5. **IAM:** Show policy JSON; change policy and show immediate effect; optional role inheritance.
6. **Isolation:** Show that database, logs, and config are on external drive; demonstrate server cannot write to host filesystem; **disconnect external drive and show graceful handling**.

---

## 12. License

**MIT License**

Permissive open-source license allowing commercial use, modification, and distribution. Retains copyright while maximizing flexibility for future use and contributions.

---

## 13. Project Summary

- **Technical scope:** Full-stack (frontend, backend, DB, object storage); security (encryption, IAM, audit, **filesystem isolation**); API and scalability considerations; **resource-efficient design**.
- **Practical impact:** Addresses cost and control of cloud storage; deployable product and extensible platform; **enhanced security through drive isolation**.
- **Implementation focus:** IAM and auth first; **external drive detection and path validation**; start with simple single-file storage, add multipart later; implement a minimal S3 subset (~10 operations); document continuously.