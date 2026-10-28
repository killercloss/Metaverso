import * as THREE from 'three';

export async function createPDFViewer(options)
{
    const {
        scene,
        renderer,
        source,
        panelConfig,
        registerInteractive
    } = options;

    const panel = new THREE.Group();
    panel.position.set(panelConfig.x, panelConfig.y, panelConfig.z);
    panel.rotation.y = panelConfig.rotationY;
    scene.add(panel);

    let documentPDF = null;
    let currentPage = 1;
    let plane = null;
    let frame = null;
    let pageLabel = null;
    let rendering = false;
    let pendingPage = null;
    const buttons = [];

    function makeCanvasButton(label, action, x)
    {
        const canvas = document.createElement('canvas');
        canvas.width = 300;
        canvas.height = 90;
        const context = canvas.getContext('2d');
        context.fillStyle = '#20252c';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.strokeStyle = '#ffffff';
        context.lineWidth = 4;
        context.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
        context.fillStyle = '#ffffff';
        context.font = 'bold 30px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(label, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;

        const button = new THREE.Mesh(
            new THREE.PlaneGeometry(1.75, 0.52),
            new THREE.MeshBasicMaterial(
            {
                map: texture,
                transparent: true,
                side: THREE.DoubleSide,
                toneMapped: false
            })
        );

        button.position.set(x, -4.75, 0.08);
        panel.add(button);
        buttons.push(button);
        registerInteractive(button, () => changePage(action === 'next' ? 1 : -1));
    }

    function makePageLabel()
    {
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 90;
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;

        pageLabel = new THREE.Mesh(
            new THREE.PlaneGeometry(1.9, 0.52),
            new THREE.MeshBasicMaterial(
            {
                map: texture,
                transparent: true,
                side: THREE.DoubleSide,
                toneMapped: false
            })
        );

        pageLabel.userData.canvas = canvas;
        pageLabel.userData.texture = texture;
        panel.add(pageLabel);
        updateLabel();
    }

    function updateLabel()
    {
        if(!pageLabel)
        {
            return;
        }

        const canvas = pageLabel.userData.canvas;
        const context = canvas.getContext('2d');
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = '#15191f';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.strokeStyle = '#ffffff';
        context.lineWidth = 4;
        context.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
        context.fillStyle = '#ffffff';
        context.font = 'bold 30px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(
            documentPDF ? `${currentPage} / ${documentPDF.numPages}` : 'Cargando...',
            canvas.width / 2,
            canvas.height / 2
        );
        pageLabel.userData.texture.needsUpdate = true;
    }

    async function renderPage(pageNumber)
    {
        if(!documentPDF)
        {
            return;
        }

        const safePage = Math.max(1, Math.min(pageNumber, documentPDF.numPages));

        if(rendering)
        {
            pendingPage = safePage;
            return;
        }

        rendering = true;

        try
        {
            const page = await documentPDF.getPage(safePage);
            const initial = page.getViewport({ scale: 1 });
            const scale = Math.min(2, 1800 / Math.max(initial.width, initial.height));
            const viewport = page.getViewport({ scale });
            const canvas = document.createElement('canvas');
            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);

            await page.render(
            {
                canvasContext: canvas.getContext('2d', { alpha: false }),
                viewport
            }).promise;

            const ratio = viewport.width / viewport.height;
            const width = Math.min(panelConfig.maxWidth, panelConfig.maxHeight * ratio);
            const height = width / ratio;
            const texture = new THREE.CanvasTexture(canvas);
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

            if(plane)
            {
                plane.material.map.dispose();
                plane.material.dispose();
                plane.geometry.dispose();
                panel.remove(plane);
            }

            if(frame)
            {
                frame.material.dispose();
                frame.geometry.dispose();
                panel.remove(frame);
            }

            frame = new THREE.Mesh(
                new THREE.BoxGeometry(width + 0.12, height + 0.12, 0.08),
                new THREE.MeshBasicMaterial({ color: 0x252a30 })
            );
            frame.position.z = -0.055;
            panel.add(frame);

            plane = new THREE.Mesh(
                new THREE.PlaneGeometry(width, height),
                new THREE.MeshBasicMaterial(
                {
                    map: texture,
                    side: THREE.DoubleSide,
                    toneMapped: false
                })
            );
            plane.position.z = 0.01;
            panel.add(plane);

            currentPage = safePage;
            updateLabel();

            const y = -(height / 2) - 0.45;
            buttons.forEach(button => button.position.y = y);
            pageLabel.position.y = y;
        }
        finally
        {
            rendering = false;

            if(pendingPage !== null)
            {
                const next = pendingPage;
                pendingPage = null;

                if(next !== currentPage)
                {
                    renderPage(next);
                }
            }
        }
    }

    function changePage(delta)
    {
        if(!documentPDF)
        {
            return;
        }

        renderPage(currentPage + delta).catch(console.error);
    }

    const pdfjs = await import(
        'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs'
    );
    pdfjs.GlobalWorkerOptions.workerSrc =
        'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.mjs';

    documentPDF = await pdfjs.getDocument(source).promise;
    makePageLabel();
    makeCanvasButton('ANTERIOR', 'previous', -2.1);
    makeCanvasButton('SIGUIENTE', 'next', 2.1);
    await renderPage(1);

    return {
        panel,
        renderPage,
        changePage,
        get currentPage()
        {
            return currentPage;
        },
        get totalPages()
        {
            return documentPDF?.numPages || 0;
        }
    };
}
