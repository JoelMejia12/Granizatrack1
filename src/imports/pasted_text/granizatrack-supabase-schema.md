Estoy creando una aplicación web llamada GranizaTrack conectada a Supabase.

IMPORTANTE:
Usa EXACTAMENTE la estructura de base de datos existente.
NO inventes tablas.
NO inventes columnas.
NO cambies nombres.
NO uses Firebase.
NO uses "profiles".

========================================
📦 ESTRUCTURA DE BASE DE DATOS
========================================

TABLAS:

usuarios:
- id (uuid)
- email (text)
- nombre (text)
- rol (admin | trabajador)
- activo (bool)

carretillas:
- id
- codigo
- estado (disponible | en_uso | mantenimiento)

asignaciones:
- id
- trabajador_id
- carretilla_id
- activa

jornadas:
- id
- trabajador_id
- carretilla_id
- estado (activa | finalizada | cancelada)
- hora_inicio
- hora_fin

ubicaciones:
- id
- jornada_id
- latitud
- longitud
- timestamp

productos:
- id
- nombre
- activo

ventas:
- id
- trabajador_id
- carretilla_id
- jornada_id
- total
- nota
- created_at

detalle_ventas:
- id
- venta_id
- producto_id
- cantidad
- precio_unitario
- subtotal

========================================
🔐 AUTENTICACIÓN
========================================

- Usar Supabase Auth
- Login con email y password
- Después del login:
  - buscar usuario en tabla usuarios usando auth.user.id
  - si no existe → cerrar sesión

========================================
👤 ROLES
========================================

ADMIN:
- acceso completo

TRABAJADOR:
- solo su información
- su jornada
- sus ventas
- su GPS

========================================
📱 FLUJO TRABAJADOR
========================================

1. Ver carretilla asignada (tabla asignaciones)

2. Botón "Iniciar jornada":
   → insertar en jornadas:
     trabajador_id
     carretilla_id
     estado = 'activa'
     hora_inicio = now()

3. GPS AUTOMÁTICO (SIN BOTÓN MANUAL)

- usar navigator.geolocation.watchPosition

- cada actualización:
  insertar en ubicaciones:
    jornada_id
    latitud
    longitud
    timestamp

REGLAS:
- guardar cada 30 segundos mínimo
- o si el usuario se mueve más de 20 metros
- SOLO si hay jornada activa

Mostrar en UI:
- estado: "GPS activo"
- última ubicación
- hora del último punto

4. Botón "Finalizar jornada":
   → actualizar jornadas:
     estado = 'finalizada'
     hora_fin = now()

========================================
💰 VENTAS (PRECIO DINÁMICO)
========================================

IMPORTANTE:

- El ADMIN solo crea productos
- NO hay precio fijo en productos
- El TRABAJADOR define el precio en cada venta

Flujo:

1. Seleccionar producto
2. Ingresar cantidad
3. Ingresar precio_unitario manual
4. Nota opcional (extras):
   ejemplo: "extra leche", "más jarabe"

5. Calcular:
   subtotal = cantidad * precio_unitario
   total = suma de subtotales

6. Insertar:
- ventas (total, nota, trabajador, carretilla, jornada)
- detalle_ventas (producto, cantidad, precio_unitario, subtotal)

========================================
🗺️ PESTAÑA: MAPA (ADMIN)
========================================

Crear pestaña llamada "Mapa"

USAR:
- Leaflet
- OpenStreetMap
- NO Google Maps

FUNCIONALIDAD:

Mostrar TODAS las carretillas con jornada activa.

Para cada carretilla:

1. Obtener jornada activa
2. Obtener ubicaciones de esa jornada
3. Dibujar línea (ruta)

Cada ruta:
- color diferente (no repetir)

PUNTOS:

- Punto X (inicio):
  → primera ubicación
  → mostrar hora_inicio

- Punto Y (actual/final):
  → última ubicación

  mostrar:
  - código carretilla
  - trabajador
  - si activa: "Jornada activa"
  - si finalizada: hora_fin

INTERACCIÓN:

- seleccionar una carretilla:
  → mostrar solo esa ruta

========================================
📊 PESTAÑA: RUTAS (usa jornadas)
========================================

IMPORTANTE:
NO existe tabla rutas
TODO se basa en tabla jornadas

UI se llama "Rutas" pero usa jornadas

Contenido:

- Lista de carretillas
- Mostrar estado

Al seleccionar una carretilla:

- Mostrar calendario
- Elegir fecha

Al seleccionar fecha:

- consultar jornadas por:
  carretilla_id + fecha

- mostrar:
  - hora_inicio
  - hora_fin
  - estado

- mostrar mapa:
  - obtener ubicaciones usando jornada_id
  - dibujar ruta histórica

========================================
📈 PESTAÑA: REPORTES
========================================

Filtros:
- rango de fechas
- trabajador
- carretilla
- producto

Mostrar métricas:

- total vendido
- total ventas
- producto más vendido
- trabajador con más ventas
- carretilla con más ventas

Gráficos:

- barras: ventas por producto
- línea: ventas por día

Tablas:

- ventas por trabajador
- ventas por carretilla

Botón:
- Exportar CSV

========================================
🎨 DISEÑO UI
========================================

Paleta pastel:

- celeste: #AEE6F9
- rosa: #F8C8DC
- fondo claro
- diseño moderno minimalista

========================================
⚠️ REGLAS CRÍTICAS
========================================

- NO crear tablas nuevas
- NO inventar columnas
- NO usar Firebase
- NO usar profiles
- usar EXACTAMENTE Supabase
- precio lo define el trabajador
- GPS automático (sin botón manual)

========================================
🎯 OBJETIVO FINAL
========================================

Sistema completo de:

- tracking GPS automático
- mapa en tiempo real
- rutas históricas
- ventas dinámicas
- reportes y estadísticas