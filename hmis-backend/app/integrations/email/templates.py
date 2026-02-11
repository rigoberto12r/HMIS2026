"""
Email templates for various notification types.
Uses Jinja2-style templating.
"""

from datetime import datetime
from typing import Dict, Any


class EmailTemplate:
    """Base email template class."""

    @staticmethod
    def _format_date(dt: datetime) -> str:
        """Format datetime for email display."""
        return dt.strftime("%d/%m/%Y")

    @staticmethod
    def _format_time(dt: datetime) -> str:
        """Format time for email display."""
        return dt.strftime("%I:%M %p")

    @staticmethod
    def render_appointment_reminder(data: Dict[str, Any]) -> tuple[str, str]:
        """
        Render appointment reminder email.

        Args:
            data: Dict with keys: patient_name, appointment_date, appointment_time,
                  provider_name, location, specialty

        Returns:
            tuple: (html_body, text_body)
        """
        patient_name = data.get("patient_name", "Paciente")
        date = data.get("appointment_date", "")
        time = data.get("appointment_time", "")
        provider = data.get("provider_name", "Doctor")
        location = data.get("location", "Hospital")
        specialty = data.get("specialty", "")

        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: #2563eb; color: white; padding: 20px; text-align: center; }}
                .content {{ padding: 20px; background: #f9fafb; }}
                .appointment-box {{ background: white; padding: 15px; border-left: 4px solid #2563eb; margin: 20px 0; }}
                .footer {{ text-align: center; padding: 20px; font-size: 12px; color: #666; }}
                .button {{ display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🏥 Recordatorio de Cita</h1>
                </div>
                <div class="content">
                    <p>Estimado/a <strong>{patient_name}</strong>,</p>
                    <p>Le recordamos su proxima cita medica:</p>

                    <div class="appointment-box">
                        <p><strong>📅 Fecha:</strong> {date}</p>
                        <p><strong>🕒 Hora:</strong> {time}</p>
                        <p><strong>👨‍⚕️ Medico:</strong> Dr. {provider}</p>
                        {f'<p><strong>🏥 Especialidad:</strong> {specialty}</p>' if specialty else ''}
                        <p><strong>📍 Ubicacion:</strong> {location}</p>
                    </div>

                    <p><strong>Recomendaciones:</strong></p>
                    <ul>
                        <li>Llegue 15 minutos antes de su cita</li>
                        <li>Traiga su cedula y tarjeta de seguro</li>
                        <li>Traiga examenes o documentos medicos previos</li>
                    </ul>

                    <p>Si necesita cancelar o reprogramar su cita, por favor contactenos con al menos 24 horas de anticipacion.</p>

                    <p>Gracias por confiar en nosotros para su atencion medica.</p>
                </div>
                <div class="footer">
                    <p>Este es un mensaje automatico, por favor no responda a este correo.</p>
                    <p>&copy; 2026 HMIS Hospital. Todos los derechos reservados.</p>
                </div>
            </div>
        </body>
        </html>
        """

        text = f"""
        RECORDATORIO DE CITA MEDICA

        Estimado/a {patient_name},

        Le recordamos su proxima cita medica:

        Fecha: {date}
        Hora: {time}
        Medico: Dr. {provider}
        {f'Especialidad: {specialty}' if specialty else ''}
        Ubicacion: {location}

        Recomendaciones:
        - Llegue 15 minutos antes de su cita
        - Traiga su cedula y tarjeta de seguro
        - Traiga examenes o documentos medicos previos

        Si necesita cancelar o reprogramar su cita, por favor contactenos con al menos 24 horas de anticipacion.

        Gracias por confiar en nosotros para su atencion medica.

        ---
        Este es un mensaje automatico.
        © 2026 HMIS Hospital
        """

        return html, text

    @staticmethod
    def render_appointment_confirmation(data: Dict[str, Any]) -> tuple[str, str]:
        """Render appointment confirmation email."""
        patient_name = data.get("patient_name", "Paciente")
        date = data.get("appointment_date", "")
        time = data.get("appointment_time", "")
        provider = data.get("provider_name", "Doctor")

        html = f"""
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #2563eb;">✅ Cita Confirmada</h2>
                <p>Estimado/a {patient_name},</p>
                <p>Su cita ha sido confirmada exitosamente:</p>
                <div style="background: #f0f9ff; padding: 15px; border-left: 4px solid #2563eb; margin: 20px 0;">
                    <p><strong>Fecha:</strong> {date}</p>
                    <p><strong>Hora:</strong> {time}</p>
                    <p><strong>Medico:</strong> Dr. {provider}</p>
                </div>
                <p>Nos vemos pronto!</p>
            </div>
        </body>
        </html>
        """

        text = f"""
        CITA CONFIRMADA

        Estimado/a {patient_name},

        Su cita ha sido confirmada:
        Fecha: {date}
        Hora: {time}
        Medico: Dr. {provider}

        Nos vemos pronto!
        """

        return html, text

    @staticmethod
    def render_password_reset(data: Dict[str, Any]) -> tuple[str, str]:
        """Render password reset email."""
        user_name = data.get("user_name", "Usuario")
        reset_link = data.get("reset_link", "#")
        expiry_hours = data.get("expiry_hours", 24)

        html = f"""
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #2563eb;">🔐 Restablecer Contraseña</h2>
                <p>Hola {user_name},</p>
                <p>Recibimos una solicitud para restablecer tu contraseña.</p>
                <p>Haz clic en el siguiente boton para crear una nueva contraseña:</p>
                <p style="text-align: center; margin: 30px 0;">
                    <a href="{reset_link}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px;">
                        Restablecer Contraseña
                    </a>
                </p>
                <p><small>Este enlace expira en {expiry_hours} horas.</small></p>
                <p>Si no solicitaste este cambio, ignora este correo.</p>
            </div>
        </body>
        </html>
        """

        text = f"""
        RESTABLECER CONTRASEÑA

        Hola {user_name},

        Recibimos una solicitud para restablecer tu contraseña.

        Visita este enlace para crear una nueva contraseña:
        {reset_link}

        Este enlace expira en {expiry_hours} horas.

        Si no solicitaste este cambio, ignora este correo.
        """

        return html, text

    @staticmethod
    def render_lab_results_ready(data: Dict[str, Any]) -> tuple[str, str]:
        """Render lab results notification."""
        patient_name = data.get("patient_name", "Paciente")
        test_name = data.get("test_name", "Examenes")
        portal_link = data.get("portal_link", "#")

        html = f"""
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #2563eb;">🧪 Resultados de Laboratorio Listos</h2>
                <p>Estimado/a {patient_name},</p>
                <p>Sus resultados de <strong>{test_name}</strong> ya estan disponibles.</p>
                <p>Puede revisarlos en el portal de pacientes:</p>
                <p style="text-align: center; margin: 30px 0;">
                    <a href="{portal_link}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px;">
                        Ver Resultados
                    </a>
                </p>
                <p>Si tiene alguna pregunta, contacte a su medico.</p>
            </div>
        </body>
        </html>
        """

        text = f"""
        RESULTADOS DE LABORATORIO LISTOS

        Estimado/a {patient_name},

        Sus resultados de {test_name} ya estan disponibles.

        Puede revisarlos en el portal de pacientes:
        {portal_link}

        Si tiene alguna pregunta, contacte a su medico.
        """

        return html, text
