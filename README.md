# Mini ERP: comenzi, stocuri, clienți

Aplicație internă pentru un atelier care produce porți și garduri decupate laser: catalog de produse, clienți, comenzi cu flux de aprobare, stoc cu jurnal de mișcări și alerte automate de stoc minim.

**Stack:** Node.js · Express 5 · Prisma 7 · PostgreSQL · Next.js 16 · React 19 · TanStack Query · Tailwind 4 · BullMQ + Redis · Zod · Vitest + Supertest · Docker · GitHub Actions

```
apps/
  api/   Express + Prisma (REST, autentificare, roluri, joburi de fundal)
  web/   Next.js (interfața)
```

## Pornire rapidă

### Totul în Docker

```bash
docker compose up -d --build
docker compose exec api node dist/seed.js   # date demo
```

Aplicația: http://localhost:3000 · API: http://localhost:4000/api/health

Pornește 5 containere: Postgres 17, Redis 7, API-ul (aplică migrările la pornire), workerul BullMQ și interfața Next.js.

### Dezvoltare locală

Postgres și Redis rulează în Docker, iar codul rulează local, cu reîncărcare automată:

```bash
npm install
cp apps/api/.env.example apps/api/.env
npm run dev:db                                  # Postgres + Redis în Docker
cd apps/api && npx prisma migrate deploy && npm run db:seed && cd ../..
npm run dev:api                                 # terminal 2
npm run dev:worker                              # terminal 3
npm run dev:web                                 # terminal 4
```

Fără `REDIS_URL` în `apps/api/.env`, joburile de fundal rulează direct în procesul API-ului și workerul nu mai e necesar.

### Conturi demo (parola `Demo1234!`)

| Email | Rol | Ce poate face |
|---|---|---|
| admin@demo.ro | Administrator | tot |
| vanzari@demo.ro | Vânzări | clienți, creare / confirmare / anulare comenzi |
| depozit@demo.ro | Depozit | recepții și corecții de stoc, expediere / livrare |

## Teste

```bash
npm test
```

Testele de integrare rulează pe Postgres real, într-o bază separată (`mini_erp_test`, vezi `apps/api/.env.test`), deci cer `npm run dev:db` pornit. Acoperă: autentificare, permisiuni pe rol, calculul totalului pe server, tranzacții, fluxul de status, alertele de stoc și **două confirmări simultane care concurează pe ultimele bucăți din stoc**.

## Decizii de arhitectură

**Organizare pe module** (`modules/orders`, `modules/stock` etc.), fiecare cu `routes` (HTTP), `schemas` (validare Zod) și `service` (logica de business + Prisma). Rutele sunt subțiri; logica se testează prin API, fără mock-uri de bază de date.

**Permisiuni, nu roluri, în rute.** `auth/permissions.ts` e singura sursă de adevăr (`"orders:approve": ["ADMIN", "SALES"]`). API-ul trimite lista de permisiuni la login, iar interfața ascunde butoanele pe baza ei; serverul verifică oricum fiecare cerere.

**Stocul nu se editează direct.** `Product.stock` se modifică doar prin `applyMovement()`, care scrie și un rând imuabil în `StockMovement`. Orice valoare de stoc poate fi explicată din jurnal.

**Fără stoc negativ, chiar și la cereri simultane.** Scăderea e un singur `UPDATE ... WHERE stock >= cantitate`. Dacă două comenzi confirmă ultimele bucăți în același timp, baza de date serializează cele două update-uri, iar al doilea nu găsește rândul și eșuează cu 409. Varianta „citesc stocul, verific în cod, apoi scriu” are o condiție de cursă.

**Blocare optimistă pe statusul comenzii.** Schimbarea de status e `UPDATE ... WHERE id = ? AND status = <statusul citit>`. Un dublu-click sau doi utilizatori care confirmă aceeași comandă nu scad stocul de două ori.

**Fără deadlock-uri.** Produsele unei comenzi sunt blocate mereu în ordinea `productId`, deci două comenzi cu aceleași produse nu se pot bloca reciproc.

**Prețul vine din baza de date.** Clientul trimite doar `productId` și cantitatea; prețul unitar e copiat în `OrderItem` la momentul comenzii, așa că o scumpire ulterioară nu modifică comenzile vechi. Sumele sunt `Decimal(12,2)`, nu `float`.

**Joburi de fundal cu BullMQ.** După commit, API-ul pune în coadă o verificare de stoc minim pentru produsele atinse; workerul deschide sau închide alerte. Jobul are reîncercări cu backoff exponențial, iar o verificare completă rulează zilnic la 7:00. Fără Redis, același cod rulează sincron, ca proiectul să pornească fără infrastructură.

**Cel mult o alertă deschisă per produs, garantat de baza de date.** Joburile rulează în paralel (și pot veni din procese diferite), deci o verificare „există deja alertă?” urmată de insert ar crea duplicate. `StockAlert.openFor` e egal cu `productId` cât timp alerta e deschisă și `NULL` după rezolvare. Coloana e unică, iar Postgres nu consideră NULL-urile duplicate, deci a doua alertă deschisă e respinsă de index, iar jobul tratează eroarea ca „deja făcut”.

**Sesiune în cookie httpOnly**, nu în `localStorage`: JavaScript-ul din pagină nu poate citi tokenul. Next.js face proxy la `/api`, deci cookie-ul e first-party și nu e nevoie de CORS. Utilizatorul e reîncărcat din DB la fiecare request, așa că dezactivarea unui cont are efect imediat.

**Erori consecvente.** Orice eroare are forma `{ error: { code, message, details } }`; erorile Zod devin 400 cu câmpurile greșite, pe care formularele le afișează lângă input.

## Ce aș adăuga într-un proiect real

- pachet comun pentru schemele Zod și tipuri, folosit și de API și de interfață;
- teste end-to-end cu Playwright pe fluxul comandă → confirmare → expediere;
- documentație OpenAPI generată din schemele Zod;
- facturare (e-Factura), integrare cu un curier (AWB), export Excel;
- audit log pentru modificările de produse și clienți.
