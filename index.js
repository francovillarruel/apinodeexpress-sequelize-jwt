import { createRequire } from 'node:module'
import express from 'express'
import db from './db/connection.js'
import Producto from './models/producto.js'
import Usuario from './models/usuario.js'
import jwt from 'jsonwebtoken'

const require = createRequire(import.meta.url)
const datos = require('./datos.json')
const html =
'<h1>Bienvenido a la API</h1><p>Los comandos disponibles son:</p><ul><li>GET: /productos/</li><li>GET: /productos/id</li><li>POST: /productos/</li><li>DELETE: /productos/id</li><li>PUT: /productos/id</li><li>PATCH: /productos/id</li><li>GET: /usuarios/</li><li>GET: /usuarios/id</li><li>POST: /usuarios/</li><li>DELETE: /usuarios/id</li><li>PUT: /usuarios/id</li><li>PATCH: /usuarios/id</li><li>GET: /productos/precio/id</li><li>GET: /productos/nombre/id</li><li>GET: /usuarios/telefono/id</li><li>GET: /usuarios/nombre/id</li><li>GET: /productos/totalStock</li></ul>'
const app = express()
const exposedPort = 1234


// Middleware para la validación de los tokens recibidos
function autenticacionDeToken(req, res, next) {
  const headerAuthorization = req.headers['authorization'];

  if (!headerAuthorization) {
      return res.status(401).json({ message: 'Token inválido' });
  }

  const tokenParts = headerAuthorization.split(" ");

  if (tokenParts.length !== 2 || tokenParts[0] !== "Bearer") {
      return res.status(401).json({ message: 'Token inválido' });
  }

  const tokenRecibido = tokenParts[1];

  let payload = null;

  try {
      // Intentamos sacar los datos del payload del token
      payload = jwt.verify(tokenRecibido, process.env.SECRET_KEY);
  } catch (error) {
      return res.status(401).json({ message: 'Token inválido' });
  }

  if (Date.now() > payload.exp) {
      return res.status(401).json({ message: 'Token caducado' });
  }

  // Pasadas las validaciones
  req.user = payload.sub;

  next();
}

 

// Ruta para la página principal
app.get('/', (req, res) => {
  res.status(200).send(html)
})


// Middleware para parsear el cuerpo JSON de las solicitudes
app.use(express.json())


app.post('/auth', async (req, res) => {
  const usuarioABuscar = req.body.usuario
  const password = req.body.password

  try {
      // Busca el usuario en la base de datos por su nombre de usuario
      const usuarioEncontrado = await Usuario.findOne({ where: { usuario: usuarioABuscar } });

      if (!usuarioEncontrado) {
          return res.status(400).json({ message: "Usuario NO ENCONTRADO" });
      }

      if (usuarioEncontrado.password !== password) {
          return res.status(400).json({ message: "PASSWORD INCORRECTO" });
      }

      const sub = usuarioEncontrado.id;
      const usuario = usuarioEncontrado.usuario;
      const nivel = usuarioEncontrado.nivel;

      const token = jwt.sign({
          sub,
          usuario,
          nivel,
          exp: Date.now() + 3600 * 1000,
      }, process.env.SECRET_KEY);

      res.status(200).json({ accessToken: token });
  } catch (error) {
      res.status(500).json({ message: 'Error en el servidor' });
  }
});



 


// Definición de la ruta /usuarios/
app.get('/usuarios/', async (req, res) => {
  try {
    let allUsers = await Usuario.findAll()
    res.status(200).json(allUsers)
  } catch (error) {
    res.status(204).json({ message: error })
  }
})

/// 10. Crear el endpoint que permita obtener el total del stock actual de productos, la sumatoria de los precios individuales.
// Definición de la ruta /productos/totalStock utilizando Sequelize
app.get('/productos/totalStock', async (req, res) => {
  try {
    const productos = await Producto.findAll() // Utiliza el modelo Producto para obtener todos los productos

    if (productos.length === 0) {
      res.status(204).json({ message: 'No hay productos disponibles' })
      return
    }

    const totalStock = productos.reduce(
      (total, producto) => total + parseFloat(producto.precio),
      0
    )

    res.status(200).json({ totalStock })
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor' })
  }
})

// Definición de la ruta /productos/
app.get('/productos/', async (req, res) => {
  try {
    const allProducts = await Producto.findAll() // Utiliza el modelo Producto para obtener todos los productos
    res.status(200).json(allProducts)
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor' })
  }
})

// Definición de la ruta /productos/:id
app.get('/productos/:id', async (req, res) => {
  try {
    const productoId = parseInt(req.params.id)
    const productoEncontrado = await Producto.findByPk(productoId) // Utiliza el modelo Producto para buscar un producto por su ID

    if (productoEncontrado) {
      res.status(200).json(productoEncontrado)
    } else {
      res.status(404).json({ message: 'Producto no encontrado' })
    }
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor' })
  }
})

// Definición de la ruta POST /productos
app.post('/productos', async (req, res) => {
  try {
    const nuevoProducto = req.body
    const productoCreado = await Producto.create(nuevoProducto) // Utiliza el modelo Producto para crear un nuevo producto en la base de datos

    res.status(201).json(productoCreado)
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor' })
  }
})

// Definición de la ruta PATCH /productos/:id
app.patch('/productos/:id', async (req, res) => {
  try {
    const productoId = parseInt(req.params.id)
    const productoAActualizar = await Producto.findByPk(productoId) // Busca el producto por su ID

    if (productoAActualizar) {
      const data = req.body

      if (data.nombre) {
        productoAActualizar.nombre = data.nombre
      }

      if (data.tipo) {
        productoAActualizar.tipo = data.tipo
      }

      if (data.precio) {
        productoAActualizar.precio = data.precio
      }

      await productoAActualizar.save() // Guarda los cambios en la base de datos

      res.status(200).json({ message: 'Producto actualizado' })
    } else {
      res.status(404).json({ message: 'Producto no encontrado' })
    }
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor' })
  }
})

// Definición de la ruta DELETE /productos/:id
app.delete('/productos/:id', async (req, res) => {
  try {
    const productoId = parseInt(req.params.id)
    const productoABorrar = await Producto.findByPk(productoId) // Busca el producto por su ID

    if (productoABorrar) {
      await productoABorrar.destroy() // Elimina el producto de la base de datos
      res.status(200).json({ message: 'Producto eliminado' })
    } else {
      res.status(404).json({ message: 'Producto no encontrado' })
    }
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor' })
  }
})

// 1. Crear el endpoint ‘/usuarios/’ que devuelva el listado completo de usuarios.
// Definición de la ruta GET /usuarios utilizando Sequelize
app.get('/usuarios/', async (req, res) => {
  try {
    const allUsers = await Usuario.findAll() // Utiliza el modelo Usuario para obtener todos los usuarios de la base de datos
    res.status(200).json(allUsers)
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor' })
  }
})

// 2. Crear el endpoint ‘/usuarios/id’ que devuelva los datos de un usuario en particular por su número de id.
// Definición de la ruta /usuarios/dni/:dni utilizando Sequelize
app.get('/usuarios/dni/:dni', async (req, res) => {
  try {
    const dni = req.params.dni
    const userEncontrado = await Usuario.findOne({ where: { dni } })

    if (userEncontrado) {
      res.status(200).json(userEncontrado)
    } else {
      res.status(404).json({ message: 'Usuario no encontrado' })
    }
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor' })
  }
})

// 6. Crear el endpoint que permita obtener el precio de un producto que se indica por id.
// Definición de la ruta /productos/precio/:id utilizando Sequelize
app.get('/productos/precio/:id', async (req, res) => {
  try {
    const productoId = parseInt(req.params.id)
    const productoEncontrado = await Producto.findByPk(productoId) // Utiliza el modelo Producto para buscar un producto por su ID

    if (productoEncontrado) {
      res.status(200).json({ precio: productoEncontrado.precio })
    } else {
      res.status(404).json({ message: 'Producto no encontrado' })
    }
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor' })
  }
})

// 7. Crear el endpoint que permita obtener el nombre de un producto que se indica por id.
// Definición de la ruta /productos/nombre/:id utilizando Sequelize
app.get('/productos/nombre/:id', async (req, res) => {
  try {
    const productoId = parseInt(req.params.id)
    const productoEncontrado = await Producto.findByPk(productoId) // Utiliza el modelo Producto para buscar un producto por su ID

    if (productoEncontrado) {
      res.status(200).json({ nombre: productoEncontrado.nombre })
    } else {
      res.status(404).json({ message: 'Producto no encontrado' })
    }
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor' })
  }
})

// 8. Crear el endpoint que permita obtener el teléfono de un usuario que se indica por id.
// Definición de la ruta /usuarios/telefono/:id utilizando Sequelize
app.get('/usuarios/telefono/:id', async (req, res) => {
  try {
    const usuarioId = parseInt(req.params.id)
    const usuarioEncontrado = await Usuario.findByPk(usuarioId) // Utiliza el modelo Usuario para buscar un usuario por su ID en la base de datos

    if (usuarioEncontrado) {
      res.status(200).json({ telefono: usuarioEncontrado.telefono })
    } else {
      res.status(404).json({ message: 'Usuario no encontrado' })
    }
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor' })
  }
})

// 9. Crear el endpoint que permita obtener el nombre de un usuario que se indica por id.
// Definición de la ruta /usuarios/nombre/:id utilizando Sequelize
app.get('/usuarios/nombre/:id', autenticacionDeToken ,async (req, res) => {
  try {
    const usuarioId = parseInt(req.params.id)
    const usuarioEncontrado = await Usuario.findByPk(usuarioId) // Utiliza el modelo Usuario para buscar un usuario por su ID en la base de datos

    if (usuarioEncontrado) {
      res.status(200).json({ nombre: usuarioEncontrado.nombres })
    } else {
      res.status(404).json({ message: 'Usuario no encontrado' })
    }
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor' })
  }
})

// 3. Crear el endpoint ‘/usuarios/’ que permita guardar un nuevo usuario.
// Definición de la ruta POST /usuarios utilizando Sequelize
app.post('/usuarios', async (req, res) => {
  try {
    const nuevoUsuario = req.body
    const usuarioCreado = await Usuario.create(nuevoUsuario) // Utiliza el modelo Usuario para crear un nuevo usuario en la base de datos

    res.status(201).json({ message: 'Usuario creado', usuario: usuarioCreado })
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor' })
  }
})

// 4. Crear el endpoint ‘/usuarios/id’ que permita modificar algún atributo de un usuario.
// Definición de la ruta PATCH /usuarios/:id utilizando Sequelize
app.patch('/usuarios/:id', async (req, res) => {
  try {
    const usuarioId = parseInt(req.params.id)
    const usuarioAActualizar = await Usuario.findByPk(usuarioId) // Utiliza el modelo Usuario para buscar un usuario por su ID en la base de datos

    if (!usuarioAActualizar) {
      res.status(404).json({ message: 'Usuario no encontrado' })
      return
    }

    const data = req.body

    if (data.nombre) {
      usuarioAActualizar.nombre = data.nombre
    }
    if (data.telefono) {
      usuarioAActualizar.telefono = data.telefono
    }

    await usuarioAActualizar.save() // Guarda los cambios en la base de datos

    res.status(200).json({ message: 'Usuario actualizado' })
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor' })
  }
})

// 5. Crear el endpoint ‘/usuarios/id’ que permita borrar un usuario de los datos.
// Definición de la ruta DELETE /usuarios/:id utilizando Sequelize
app.delete('/usuarios/:id', autenticacionDeToken ,async (req, res) => {
  try {
    const usuarioId = parseInt(req.params.id)
    const usuarioABorrar = await Usuario.findByPk(usuarioId) // Utiliza el modelo Usuario para buscar un usuario por su ID en la base de datos

    if (usuarioABorrar) {
      await usuarioABorrar.destroy() // Elimina el usuario de la base de datos
      res.status(200).json({ message: 'Usuario eliminado' })
    } else {
      res.status(404).json({ message: 'Usuario no encontrado' })
    }
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor' })
  }
})

app.use((req, res) => {
  res.status(404).send('<h1>Error 404</h1>')
})

try {
  await db.authenticate()
  console.log('Connection has been established successfully.')
} catch (error) {
  console.error('Unable to connect to the database:', error)
}

app.listen(exposedPort, () => {
  console.log('Servidor Activo ' + exposedPort)
})
