const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

let users = [];
let products = [];
let orders = [];

function generateId() {
    return Date.now().toString() + Math.floor(Math.random() * 1000);
}

function daysUntil(dateStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const target = new Date(dateStr + "T00:00:00");
    target.setHours(0, 0, 0, 0);

    return Math.ceil((target - today) / 86400000);
}

function seedProducts() {
    if (products.length > 0) return;

    const today = new Date();
    function datePlus(days) {
        const d = new Date(today);
        d.setDate(d.getDate() + days);
        return d.toISOString().split("T")[0];
    }

    products = [
        {
            id: generateId(),
            name: "Cesta de frutas",
            category: "Frutas",
            description: "Cesta com frutas selecionadas.",
            supplier: "Mercado Esperança",
            quantity: 15,
            unit: "cesta",
            expiry: datePlus(10),
            originalPrice: 25,
            price: 12,
            offerType: "discount",
            distance: 0.8,
            pickup: "08:00 às 18:00",
            address: "Centro",
            emoji: "🍎",
            active: true
        },
        {
            id: generateId(),
            name: "Banana madura",
            category: "Frutas",
            description: "Bananas maduras próprias para consumo.",
            supplier: "Hortifruti Verde Vida",
            quantity: 30,
            unit: "kg",
            expiry: datePlus(3),
            originalPrice: 8,
            price: 3,
            offerType: "urgent",
            distance: 1.2,
            pickup: "07:00 às 18:00",
            address: "Centro",
            emoji: "🍌",
            active: true
        },
        {
            id: generateId(),
            name: "Tomates",
            category: "Legumes",
            description: "Tomates frescos selecionados.",
            supplier: "Hortifruti Verde Vida",
            quantity: 20,
            unit: "kg",
            expiry: datePlus(5),
            originalPrice: 12,
            price: 6,
            offerType: "discount",
            distance: 1.2,
            pickup: "07:00 às 18:00",
            address: "Centro",
            emoji: "🍅",
            active: true
        },
        {
            id: generateId(),
            name: "Pães artesanais",
            category: "Padaria",
            description: "Pães artesanais produzidos no dia.",
            supplier: "Padaria Sabor da Casa",
            quantity: 25,
            unit: "unidade",
            expiry: datePlus(2),
            originalPrice: 18,
            price: 4,
            offerType: "urgent",
            distance: 2.5,
            pickup: "16:00 às 20:00",
            address: "Jardim Central",
            emoji: "🥖",
            active: true
        },
        {
            id: generateId(),
            name: "Croissants",
            category: "Padaria",
            description: "Croissants frescos.",
            supplier: "Padaria Sabor da Casa",
            quantity: 12,
            unit: "unidade",
            expiry: datePlus(1),
            originalPrice: 10,
            price: 3,
            offerType: "urgent",
            distance: 2.5,
            pickup: "16:00 às 20:00",
            address: "Jardim Central",
            emoji: "🥐",
            active: true
        },
        {
            id: generateId(),
            name: "Marmita do dia",
            category: "Refeições",
            description: "Refeição completa preparada no dia.",
            supplier: "Restaurante Bom Prato",
            quantity: 18,
            unit: "unidade",
            expiry: datePlus(1),
            originalPrice: 25,
            price: 10,
            offerType: "urgent",
            distance: 0.8,
            pickup: "18:00 às 20:30",
            address: "Avenida Brasil",
            emoji: "🍱",
            active: true
        },
        {
            id: generateId(),
            name: "Kit de hortaliças",
            category: "Verduras",
            description: "Mix de verduras e folhas.",
            supplier: "Hortifruti Verde Vida",
            quantity: 10,
            unit: "kit",
            expiry: datePlus(4),
            originalPrice: 20,
            price: 9,
            offerType: "discount",
            distance: 1.2,
            pickup: "07:00 às 18:00",
            address: "Centro",
            emoji: "🥬",
            active: true
        },
        {
            id: generateId(),
            name: "Leite próximo do vencimento",
            category: "Laticínios",
            description: "Leite refrigerado dentro da validade.",
            supplier: "Supermercado Economia",
            quantity: 20,
            unit: "litro",
            expiry: datePlus(3),
            originalPrice: 6,
            price: 2.5,
            offerType: "urgent",
            distance: 3.7,
            pickup: "08:00 às 19:00",
            address: "Setor Oeste",
            emoji: "🥛",
            active: true
        },
        {
            id: generateId(),
            name: "Legumes variados",
            category: "Legumes",
            description: "Mix de legumes frescos.",
            supplier: "Mercado Esperança",
            quantity: 15,
            unit: "kg",
            expiry: datePlus(8),
            originalPrice: 18,
            price: 9,
            offerType: "discount",
            distance: 0.8,
            pickup: "08:00 às 18:00",
            address: "Centro",
            emoji: "🥕",
            active: true
        },
        {
            id: generateId(),
            name: "Bolo do dia",
            category: "Padaria",
            description: "Bolo caseiro produzido hoje.",
            supplier: "Padaria Sabor da Casa",
            quantity: 8,
            unit: "unidade",
            expiry: datePlus(1),
            originalPrice: 20,
            price: 7,
            offerType: "urgent",
            distance: 2.5,
            pickup: "17:00 às 20:00",
            address: "Jardim Central",
            emoji: "🍰",
            active: true
        },
        {
            id: generateId(),
            name: "Cesta de supermercado",
            category: "Mercado",
            description: "Produtos variados próximos da validade.",
            supplier: "Supermercado Economia",
            quantity: 6,
            unit: "cesta",
            expiry: datePlus(6),
            originalPrice: 60,
            price: 25,
            offerType: "discount",
            distance: 3.7,
            pickup: "08:00 às 19:00",
            address: "Setor Oeste",
            emoji: "🛒",
            active: true
        },
        {
            id: generateId(),
            name: "Kit de alimentos gratuitos",
            category: "Doações",
            description: "Alimentos disponíveis gratuitamente.",
            supplier: "Mercado Esperança",
            quantity: 10,
            unit: "kit",
            expiry: datePlus(4),
            originalPrice: 30,
            price: 0,
            offerType: "donation",
            distance: 0.8,
            pickup: "10:00 às 16:00",
            address: "Centro",
            emoji: "💚",
            active: true
        }
    ];
}

seedProducts();

app.post("/api/register", (req, res) => {
    const userData = req.body;
    const exists = users.some(u => u.email === userData.email);

    if (exists) {
        return res.status(400).json({ message: "Este e-mail já está cadastrado." });
    }

    const newUser = { id: generateId(), ...userData };
    users.push(newUser);
    res.status(201).json(newUser);
});

app.post("/api/login", (req, res) => {
    const { email, password } = req.body;
    const user = users.find(u => u.email === email && u.password === password);

    if (!user) {
        return res.status(401).json({ message: "E-mail ou senha incorretos." });
    }

    res.json(user);
});

app.get("/api/products", (req, res) => {
    res.json(products);
});

app.post("/api/products", (req, res) => {
    const productData = req.body;

    const newProduct = {
        id: generateId(),
        ...productData,
        active: true
    };

    products.push(newProduct);
    res.status(201).json(newProduct);
});

app.put("/api/products/:id", (req, res) => {
    const { id } = req.params;
    const index = products.findIndex(p => p.id === id);

    if (index === -1) {
        return res.status(404).json({ message: "Produto não encontrado." });
    }

    products[index] = { ...products[index], ...req.body };
    res.json(products[index]);
});

app.patch("/api/products/:id/toggle", (req, res) => {
    const { id } = req.params;
    const product = products.find(p => p.id === id);

    if (!product) {
        return res.status(404).json({ message: "Produto não encontrado." });
    }

    product.active = product.active === false;
    res.json(product);
});

app.delete("/api/products/:id", (req, res) => {
    const { id } = req.params;
    products = products.filter(p => p.id !== id);
    res.json({ message: "Produto removido com sucesso." });
});

app.get("/api/orders", (req, res) => {
    res.json(orders);
});

app.post("/api/orders", (req, res) => {
    const { userId, productsItems, receiptType, address, total } = req.body;

    for (const item of productsItems) {
        const product = products.find(p => p.id === item.productId);

        if (!product || product.quantity < item.quantity) {
            return res.status(400).json({ message: `Estoque insuficiente para ${item.name || 'o produto'}.` });
        }

        if (daysUntil(product.expiry) < 0) {
            return res.status(400).json({ message: `${product.name} não está mais disponível.` });
        }
    }

    productsItems.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        if (product) {
            product.quantity -= item.quantity;
        }
    });

    const orderNumber = "PF-" + Math.floor(100000 + Math.random() * 900000);

    const order = {
        id: generateId(),
        number: orderNumber,
        userId,
        date: new Date().toISOString(),
        products: productsItems,
        total,
        receiptType,
        address,
        status: "Pedido realizado"
    };

    orders.push(order);
    res.status(201).json(order);
});

app.patch("/api/orders/:id/status", (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const order = orders.find(o => o.id === id);
    if (!order) {
        return res.status(404).json({ message: "Pedido não encontrado." });
    }

    order.status = status;
    res.json(order);
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});