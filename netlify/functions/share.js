const axios = require('axios');
const cheerio = require('cheerio');

exports.handler = async (event, context) => {
    // استخراج معطيات الرابط (الرابط الأصلي، رقم الهاتف الجديد، الاسم الجديد)
    const originalUrl = event.queryStringParameters.url;
    const agentPhone = event.queryStringParameters.phone; // الصيغة المفضلة: 905396426976
    const agentName = event.queryStringParameters.name || "المستشار العقاري";

    // التحقق من وجود المدخلات الأساسية
    if (!originalUrl) {
        return {
            statusCode: 400,
            headers: { "Content-Type": "text/html; charset=utf-8" },
            body: "<h3>خطأ: يرجى تزويد الرابط الأصلي للإعلان. مثال: url=https://makrolife.com.tr/...</h3>"
        };
    }

    if (!agentPhone) {
        return {
            statusCode: 400,
            headers: { "Content-Type": "text/html; charset=utf-8" },
            body: "<h3>خطأ: يرجى تزويد رقم هاتف الوكيل الجديد. مثال: phone=905xxxxxxxxx</h3>"
        };
    }

    try {
        // 1. جلب كود الـ HTML للإعلان الأصلي
        const response = await axios.get(originalUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        const html = response.data;
        const $ = cheerio.load(html);

        // 2. معالجة وتصحيح روابط ملفات التنسيق والـ CSS والصور لتشير للموقع الأصلي
        $('a, link, img, script').each((i, el) => {
            const href = $(el).attr('href');
            if (href && href.startsWith('/') && !href.startsWith('//')) {
                $(el).attr('href', 'https://makrolife.com.tr' + href);
            }
            const src = $(el).attr('src');
            if (src && src.startsWith('/') && !src.startsWith('//')) {
                $(el).attr('src', 'https://makrolife.com.tr' + src);
            }
            const dataSrc = $(el).attr('data-src');
            if (dataSrc && dataSrc.startsWith('/') && !dataSrc.startsWith('//')) {
                $(el).attr('data-src', 'https://makrolife.com.tr' + dataSrc);
            }
        });

        // 3. استبدال بيانات التواصل في الباند العلوي الخاص بصاحب الإعلان (dt-owner)
        // استبدال الاسم
        $('.dt-owner-name').text(agentName);
        $('.dt-owner-name').attr('href', '#'); // إزالة رابط صفحة المستشار الأصلي

        // استبدال زر الاتصال العلوي
        $('.dt-owner-call').attr('href', `tel:+${agentPhone}`);
        $('.dt-owner-call span').text(`+${agentPhone.replace(/(\d{2})(\d{3})(\d{3})(\d{4})/, "$1 $2 $3 $4")}`);

        // استبدال زر الواتساب العلوي
        const wpTextTop = encodeURIComponent(`Merhaba, ${originalUrl} ilanınız hakkında bilgi alabilir miyim?`);
        $('.dt-owner-wp').attr('href', `https://wa.me/${agentPhone}?text=${wpTextTop}`);

        // 4. استبدال بيانات التواصل في باند الاتصال السفلي (dt-contact-block)
        // زر الاتصال الهاتفي السفلي
        $('.dt-contact-block .dt-btn-primary').attr('href', `tel:+${agentPhone}`);
        
        // أزرار الواتساب السفلية (تقديم عرض / طلب معاينة)
        const wpTextOffer = encodeURIComponent(`Merhaba, ${originalUrl} ilanınız hakkında teklif vermek istiyorum.`);
        const wpTextRequest = encodeURIComponent(`Merhaba, ${originalUrl} ilanını görmek istiyorum. Uygun olduğunuz zamanı paylaşır mısınız?`);
        
        $('.dt-contact-block .dt-btn-wp').attr('href', `https://wa.me/${agentPhone}?text=${wpTextOffer}`);
        $('.dt-contact-block .dt-btn-outline').attr('href', `https://wa.me/${agentPhone}?text=${wpTextRequest}`);

        // 5. استبدال اسم العميل في جدول المواصفات (dt-spec)
        $('.dt-spec tr').each((i, el) => {
            const headerText = $(el).find('th').text().trim();
            if (headerText === "Kimden" || headerText === "İlan Sahibi") {
                $(el).find('td').text(agentName);
                $(el).find('td').removeClass('td-accent'); // إزالة اللون المميز اختياريًا
            }
        });

        // 6. تعطيل الأكواد البرمجية التي قد تقوم بتحديث الصفحة أو إعادتها للموقع الأصلي (إن وجدت)
        $('script').each((i, el) => {
            const scriptContent = $(el).html();
            // مسح أي كود يحاول إعادة التوجيه لـ index.php أو فحص أدوات المطورين بشكل قد يعيق العرض
            if (scriptContent.includes('window.location.href') || scriptContent.includes('debugger')) {
                $(el).html('');
            }
        });

        // إرجاع كود الـ HTML المعدل والجاهز بالكامل للمتصفح
        return {
            statusCode: 200,
            headers: {
                "Content-Type": "text/html; charset=utf-8",
                "Access-Control-Allow-Origin": "*"
            },
            body: $.html()
        };

    } catch (error) {
        console.error("خطأ أثناء جلب أو تعديل البيانات:", error.message);
        return {
            statusCode: 500,
            headers: { "Content-Type": "text/html; charset=utf-8" },
            body: `<h3>حدث خطأ أثناء معالجة الإعلان. يرجى التحقق من صحة الرابط الأصلي.</h3><p>${error.message}</p>`
        };
    }
};
