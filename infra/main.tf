terraform {
  required_version = ">= 1.6"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws",
      version = "~> 6.0",
    }
  }
}


provider "aws" {
  region = var.region
}


variable "region" {
  default = "ap-south-1"
}


variable "name" {
  default = "infinity-studio"
}


variable "vpc_id" {
  type = string
}


variable "private_subnets" {
  type = list(string)
}


variable "public_subnets" {
  type = list(string)
}


variable "certificate_arn" {
  type = string
}


variable "web_image" {
  type = string
}


variable "api_image" {
  type = string
}


variable "origin" {
  type = string
}


variable "app_secret_arn" {
  type = string
}


variable "cognito_pool_id" {
  type = string
}


variable "cognito_client_id" {
  type = string
}


variable "ses_from" {
  type = string
}


variable "alert_email" {
  type = string
}


variable "monthly_budget_usd" {
  default = "200"
}


resource "aws_cloudwatch_log_group" "app" {
  name              = "/ecs/${var.name}"
  retention_in_days = 30
}


resource "aws_security_group" "alb" {
  name   = "${var.name}-alb"
  vpc_id = var.vpc_id
  
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [
      "0.0.0.0/0",
    ]
  }
  

  egress {
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [
      aws_security_group.app.id,
    ]
  }
}


resource "aws_security_group" "app" {
  name   = "${var.name}-app"
  vpc_id = var.vpc_id
}


resource "aws_vpc_security_group_ingress_rule" "app" {
  security_group_id            = aws_security_group.app.id
  referenced_security_group_id = aws_security_group.alb.id
  from_port                    = 3000
  to_port                      = 3000
  ip_protocol                  = "tcp"
}


resource "aws_vpc_security_group_egress_rule" "outbound" {
  security_group_id = aws_security_group.app.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}


resource "aws_security_group" "db" {
  name   = "${var.name}-db"
  vpc_id = var.vpc_id
  
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [
      aws_security_group.app.id,
    ]
  }
}


resource "aws_db_subnet_group" "db" {
  name       = var.name
  subnet_ids = var.private_subnets
}


resource "aws_db_instance" "postgres" {
  identifier                      = var.name
  engine                          = "postgres"
  engine_version                  = "16"
  instance_class                  = "db.t4g.medium"
  allocated_storage               = 100
  max_allocated_storage           = 500
  storage_type                    = "gp3"
  storage_encrypted               = true
  db_name                         = "studio"
  username                        = "studioadmin"
  manage_master_user_password     = true
  db_subnet_group_name            = aws_db_subnet_group.db.name
  vpc_security_group_ids          = [
    aws_security_group.db.id,
  ]
  publicly_accessible             = false
  multi_az                        = true
  backup_retention_period         = 14
  deletion_protection             = true
  skip_final_snapshot             = false
  final_snapshot_identifier       = "${var.name}-final"
  auto_minor_version_upgrade      = true
  enabled_cloudwatch_logs_exports = [
    "postgresql",
    "upgrade",
  ]
}


resource "aws_s3_bucket" "media" {
  bucket_prefix = "${var.name}-media-"
}


resource "aws_s3_bucket_public_access_block" "media" {
  bucket                  = aws_s3_bucket.media.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}


resource "aws_s3_bucket_versioning" "media" {
  bucket = aws_s3_bucket.media.id
  
  versioning_configuration {
    status = "Enabled"
  }
}


resource "aws_s3_bucket_server_side_encryption_configuration" "media" {
  bucket = aws_s3_bucket.media.id
  
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}


resource "aws_s3_bucket_lifecycle_configuration" "media" {
  bucket = aws_s3_bucket.media.id
  
  rule {
    id     = "quarantine-expiry"
    status = "Enabled"
    
    filter {
      prefix = "quarantine/"
    }
    

    expiration {
      days = 1
    }
  }
  

  rule {
    id     = "old-versions"
    status = "Enabled"
    
    filter {

    }
    

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}


resource "aws_s3_bucket_cors_configuration" "media" {
  bucket = aws_s3_bucket.media.id
  
  cors_rule {
    allowed_headers = [
      "content-type",
      "x-amz-*",
    ]
    allowed_methods = [
      "PUT",
    ]
    allowed_origins = [
      var.origin,
    ]
    max_age_seconds = 300
  }
}


resource "aws_cloudfront_origin_access_control" "media" {
  name                              = "${var.name}-media"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}


resource "aws_cloudfront_distribution" "media" {
  enabled     = true
  price_class = "PriceClass_All"
  
  origin {
    domain_name              = aws_s3_bucket.media.bucket_regional_domain_name
    origin_id                = "media"
    origin_path              = "/public"
    origin_access_control_id = aws_cloudfront_origin_access_control.media.id
  }
  

  default_cache_behavior {
    target_origin_id       = "media"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = [
      "GET",
      "HEAD",
    ]
    cached_methods         = [
      "GET",
      "HEAD",
    ]
    compress               = true
    cache_policy_id        = "658327ea-f89d-4fab-a63d-7e88639e58f6"
  }
  

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
  

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}


resource "aws_s3_bucket_policy" "media" {
  bucket = aws_s3_bucket.media.id
  policy = jsonencode({
    Version   = "2012-10-17",
    Statement = [
      {
        Effect    = "Allow",
        Principal = {
          Service = "cloudfront.amazonaws.com"
        },
        Action    = "s3:GetObject",
        Resource  = "${aws_s3_bucket.media.arn}/public/*",
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.media.arn
          }
        }
      },
      {
        Effect    = "Deny",
        Principal = "*",
        Action    = "s3:*",
        Resource  = [
          aws_s3_bucket.media.arn,
          "${aws_s3_bucket.media.arn}/*"
        ],
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      }
    ]
  })
}


resource "aws_ecs_cluster" "app" {
  name = var.name
  
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}


resource "aws_iam_role" "execution" {
  name               = "${var.name}-execution"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17",
    Statement = [
      {
        Effect    = "Allow",
        Action    = "sts:AssumeRole",
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
}


resource "aws_iam_role_policy_attachment" "execution" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}


resource "aws_iam_role_policy" "secret" {
  role   = aws_iam_role.execution.id
  policy = jsonencode({
    Version   = "2012-10-17",
    Statement = [
      {
        Effect   = "Allow",
        Action   = [
          "secretsmanager:GetSecretValue"
        ],
        Resource = [
          var.app_secret_arn
        ]
      }
    ]
  })
}


resource "aws_iam_role" "task" {
  name               = "${var.name}-task"
  assume_role_policy = aws_iam_role.execution.assume_role_policy
}


resource "aws_iam_role_policy" "task" {
  role   = aws_iam_role.task.id
  policy = jsonencode({
    Version   = "2012-10-17",
    Statement = [
      {
        Effect   = "Allow",
        Action   = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ],
        Resource = [
          "${aws_s3_bucket.media.arn}/quarantine/*",
          "${aws_s3_bucket.media.arn}/public/studios/*"
        ]
      },
      {
        Effect   = "Allow",
        Action   = [
          "ses:SendEmail"
        ],
        Resource = "arn:aws:ses:${var.region}:*:identity/${var.ses_from}"
      }
    ]
  })
}


resource "aws_ecs_task_definition" "app" {
  family                   = var.name
  requires_compatibilities = [
    "FARGATE",
  ]
  network_mode             = "awsvpc"
  cpu                      = "1024"
  memory                   = "2048"
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn
  container_definitions    = jsonencode([
    {
      name             = "api",
      image            = var.api_image,
      essential        = true,
      portMappings     = [
        {
          containerPort = 4000
        }
      ],
      environment      = [
        {
          name  = "NODE_ENV",
          value = "production"
        },
        {
          name  = "PORT",
          value = "4000"
        },
        {
          name  = "WEB_ORIGIN",
          value = var.origin
        },
        {
          name  = "AWS_REGION",
          value = var.region
        },
        {
          name  = "COGNITO_USER_POOL_ID",
          value = var.cognito_pool_id
        },
        {
          name  = "COGNITO_CLIENT_ID",
          value = var.cognito_client_id
        },
        {
          name  = "S3_MEDIA_BUCKET",
          value = aws_s3_bucket.media.id
        },
        {
          name  = "MEDIA_CDN_URL",
          value = "https://${aws_cloudfront_distribution.media.domain_name}"
        }
      ],
      secrets          = [
        for key in [
          "DATABASE_URL",
          "OTP_PEPPER",
          "RAZORPAY_KEY_ID",
          "RAZORPAY_KEY_SECRET",
          "RAZORPAY_WEBHOOK_SECRET"
        ] :
        {
          name      = key,
          valueFrom = "${var.app_secret_arn}:${key}::"
        }
      ],
      logConfiguration = {
        logDriver = "awslogs",
        options   = {
          awslogs-group         = aws_cloudwatch_log_group.app.name,
          awslogs-region        = var.region,
          awslogs-stream-prefix = "api"
        }
      }
    },
    {
      name             = "web",
      image            = var.web_image,
      essential        = true,
      portMappings     = [
        {
          containerPort = 3000
        }
      ],
      environment      = [
        {
          name  = "NODE_ENV",
          value = "production"
        },
        {
          name  = "PORT",
          value = "3000"
        },
        {
          name  = "API_INTERNAL_URL",
          value = "http://127.0.0.1:4000"
        },
        {
          name  = "NEXT_PUBLIC_SITE_URL",
          value = var.origin
        },
        {
          name  = "MEDIA_CDN_URL",
          value = "https://${aws_cloudfront_distribution.media.domain_name}"
        }
      ],
      logConfiguration = {
        logDriver = "awslogs",
        options   = {
          awslogs-group         = aws_cloudwatch_log_group.app.name,
          awslogs-region        = var.region,
          awslogs-stream-prefix = "web"
        }
      }
    }
  ])
}


resource "aws_lb" "app" {
  name                       = var.name
  internal                   = false
  load_balancer_type         = "application"
  security_groups            = [
    aws_security_group.alb.id,
  ]
  subnets                    = var.public_subnets
  enable_deletion_protection = true
}


resource "aws_lb_target_group" "web" {
  name        = var.name
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"
  
  health_check {
    path     = "/api/v1/health"
    matcher  = "200"
    interval = 30
  }
}


resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.app.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.certificate_arn
  
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web.arn
  }
}


resource "aws_ecs_service" "app" {
  name                               = var.name
  cluster                            = aws_ecs_cluster.app.id
  task_definition                    = aws_ecs_task_definition.app.arn
  desired_count                      = 2
  launch_type                        = "FARGATE"
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200
  
  network_configuration {
    subnets          = var.private_subnets
    security_groups  = [
      aws_security_group.app.id,
    ]
    assign_public_ip = false
  }
  

  load_balancer {
    target_group_arn = aws_lb_target_group.web.arn
    container_name   = "web"
    container_port   = 3000
  }

  depends_on = [
    aws_lb_listener.https,
  ]
}


resource "aws_sns_topic" "alerts" {
  name = "${var.name}-alerts"
}


resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}


resource "aws_cloudwatch_metric_alarm" "errors" {
  alarm_name          = "${var.name}-alb-errors"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "HTTPCode_Target_5XX_Count"
  statistic           = "Sum"
  period              = 60
  evaluation_periods  = 3
  threshold           = 10
  comparison_operator = "GreaterThanThreshold"
  dimensions          = {
    LoadBalancer = aws_lb.app.arn_suffix,
  }
  alarm_actions       = [
    aws_sns_topic.alerts.arn,
  ]
}


resource "aws_budgets_budget" "monthly" {
  name         = "${var.name}-monthly"
  budget_type  = "COST"
  limit_amount = var.monthly_budget_usd
  limit_unit   = "USD"
  time_unit    = "MONTHLY"
  
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [
      var.alert_email,
    ]
  }
}


output "alb_dns_name" {
  value = aws_lb.app.dns_name
}


output "media_cdn" {
  value = "https://${aws_cloudfront_distribution.media.domain_name}"
}


output "database_endpoint" {
  value = aws_db_instance.postgres.endpoint
}
