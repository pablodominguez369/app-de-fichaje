# Fichaje automático

App web mobile-first (React + TypeScript + Vite) para fichar entrada/salida, calcular horas trabajadas y sincronizar cada turno con Google Calendar. Sin backend: todo se guarda en `localStorage`.

## Puesta en marcha

```bash
npm install
cp .env.example .env      # y pon tu VITE_GOOGLE_CLIENT_ID
npm run dev               # http://localhost:5173
npm test                  # tests de cálculo de horas
npm run build             # genera dist/ (estático, desplegable en Vercel)
```

## Crear el OAuth Client ID de Google

1. En [Google Cloud Console](https://console.cloud.google.com/) crea (o elige) un proyecto.
2. **APIs y servicios → Biblioteca**: habilita **Google Calendar API**.
3. **Pantalla de consentimiento OAuth** (Google Auth Platform): tipo *Externo*, añade el scope `https://www.googleapis.com/auth/calendar.events` y tu cuenta como *usuario de prueba* mientras la app esté en modo "Testing".
4. **Credenciales → Crear credenciales → ID de cliente de OAuth → Aplicación web**.
   - *Orígenes de JavaScript autorizados*: `http://localhost:5173` y tu dominio de producción (p. ej. `https://tu-app.vercel.app`). No hace falta URI de redirección (se usa el flujo de token en popup).
5. Copia el Client ID en `.env` como `VITE_GOOGLE_CLIENT_ID`. En Vercel, añádela en *Project Settings → Environment Variables* y vuelve a desplegar.

El Client ID es público por diseño; **nunca** pongas el *client secret* en el frontend.

## Estructura

```
src/
  types.ts                    Shift y CalendarConfig
  lib/storage.ts              lectura/escritura segura en localStorage
  lib/time.ts                 periodos (semana desde lunes), formato, ajuste de horas
  lib/time.test.ts            tests (vitest)
  lib/googleCalendar.ts       OAuth con Google Identity Services + crear/actualizar eventos
  hooks/useTimeTracking.ts    estado de la app, fichar, sincronizar
  hooks/useNow.ts             reloj en vivo
  components/                 pantallas: Fichaje, Resumen, Ajustar turno, Historial, Calendar
```

Correspondencia con el modelo de la especificación: `fechaInicio → startAt`, `fechaFin → endAt`, `duracionMinutos → durationMinutes`, `sincronizado → synced`, `eventoCalendarId → calendarEventId`; `ConfigCalendar.tokenAcceso → accessToken` (más `expiresAt`).

## Comportamiento

- **Fichar salida** cierra el turno, abre *Ajustar turno* y, si Calendar está conectado, crea el evento y guarda su id.
- **Ajustar turno → Guardar** recalcula la duración y deja el turno como *Pendiente* si cambió. **Sincronizar** hace `PATCH` del evento existente (no crea otro). Si el evento se borró en Calendar, se restaura o se crea de nuevo.
- Si la salida es anterior a la entrada se interpreta como turno nocturno (termina al día siguiente).
- Los totales de Hoy/Semana/Mes/Año suman turnos cerrados; un turno que cruza medianoche se reparte entre los días.
- Los turnos *Pendientes* se pueden sincronizar uno a uno o todos desde el Historial.

## Funciones del contrato

- **Descansos**: botón *Iniciar/Terminar descanso* durante el turno. Los descansos se descuentan del tiempo trabajado y se pueden editar en *Ajustar turno*.
- **Contador anual**: horas ordinarias hechas frente al objetivo del año (proporcional si el contrato empezó este año) y si vas por encima o por debajo del ritmo. Admite un saldo inicial con las horas hechas antes de usar la app.
- **Horas complementarias**: dentro de cada semana (lunes a domingo) las primeras *N* horas son ordinarias y el resto complementarias. Aviso al llegar al 80 % y al 100 % del máximo anual.
- **Vacaciones y ausencias**: vacaciones por rango de días naturales con contador de días restantes; visitas médicas, permisos y bajas con horas opcionales y nota.
- **PDF mensual**: registro día a día (entrada, salida, descansos, ordinarias y complementarias) más las ausencias del mes.

Las cifras (horas anuales, máximo de complementarias, umbral semanal, días de vacaciones) se configuran en *Ajustes* y solo se guardan en el dispositivo.

## Seguridad y limitaciones

- El access token de Google se guarda en `localStorage` (requisito de la especificación). Cualquier script que corra en tu dominio (XSS, una dependencia comprometida) podría leerlo y acceder a tus eventos durante su validez (~1 h). Se mitiga pidiendo solo el scope `calendar.events`, sin refresh token, y revocándolo al desconectar. Para producción con más usuarios, lo correcto es un backend (p. ej. Supabase Edge Functions) con el flujo *authorization code*.
- El token caduca a la hora; al sincronizar se renueva con un popup (normalmente sin pedir consentimiento de nuevo). Si el popup se bloquea, el turno queda *Pendiente*.
- Los datos viven solo en este navegador/dispositivo: borrar datos del sitio los elimina.
