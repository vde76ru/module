// ===================================================
// ФАЙЛ: frontend/src/components/Products/ProductImport.jsx
// ИСПРАВЛЕНО: Правильные импорты с алиасами
// ===================================================
import React, { useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Modal,
  Upload,
  Button,
  Steps,
  Table,
  Select,
  Card,
  Alert,
  Progress,
  Space,
  Typography,
  Divider,
  Row,
  Col,
  message,
  Checkbox,
  Tag,
  Tooltip,
  Switch
} from 'antd';
import {
  UploadOutlined,
  FileExcelOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  DownloadOutlined,
  ReloadOutlined,
  SettingOutlined
} from '@ant-design/icons';

// ✅ ИСПРАВЛЕНО: Правильные импорты с относительными путями
import { importProducts, fetchProducts } from '../../store/productsSlice';
import api from '../../services/api';

const { Step } = Steps;
const { Option } = Select;
const { Title, Text } = Typography;
const { Dragger } = Upload;

const ProductImport = ({ visible, onClose }) => {
  const dispatch = useDispatch();
  const { loading } = useSelector((state) => state.products);

  const [currentStep, setCurrentStep] = useState(0);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [mappingConfig, setMappingConfig] = useState({});
  const [suppliers, setSuppliers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState(null);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [importOptions, setImportOptions] = useState({
    updateExisting: true,
    createCategories: true,
    validatePrices: true,
    skipErrors: false
  });

  React.useEffect(() => {
    if (visible) {
      fetchSuppliers();
      fetchCategories();
    }
  }, [visible]);

  const fetchSuppliers = async () => {
    try {
      const response = await api.get('/api/suppliers');
      setSuppliers(response.data.data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await api.get('/api/categories');
      setCategories(response.data.data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleClose = () => {
    setCurrentStep(0);
    setUploadedFile(null);
    setPreviewData([]);
    setMappingConfig({});
    setImportProgress(0);
    setImportResults(null);
    setSelectedSupplier(null);
    onClose();
  };

  const handleFinish = () => {
    dispatch(fetchProducts());
    handleClose();
  };

  // Маппинг полей для автоматического определения
  const fieldMappingRules = {
    name: ['название', 'наименование', 'name', 'title', 'товар'],
    sku: ['sku', 'артикул', 'код', 'article', 'code'],
    price: ['цена', 'price', 'стоимость', 'cost'],
    quantity: ['количество', 'остаток', 'qty', 'quantity', 'stock'],
    description: ['описание', 'description', 'комментарий'],
    category: ['категория', 'category', 'группа'],
    brand: ['бренд', 'brand', 'марка', 'производитель'],
    weight: ['вес', 'weight', 'масса'],
    dimensions: ['размеры', 'dimensions', 'габариты']
  };

  // Обработка загрузки файла
  const uploadProps = {
    name: 'file',
    multiple: false,
    accept: '.xlsx,.xls,.csv',
    showUploadList: false,
    beforeUpload: (file) => {
      const isValidType = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                         file.type === 'application/vnd.ms-excel' ||
                         file.type === 'text/csv';
      
      if (!isValidType) {
        message.error('Поддерживаются только файлы Excel (.xlsx, .xls) и CSV');
        return false;
      }

      const isLt10M = file.size / 1024 / 1024 < 10;
      if (!isLt10M) {
        message.error('Размер файла не должен превышать 10MB');
        return false;
      }

      return false; // Предотвращаем автоматическую загрузку
    },
    customRequest: async ({ file, onSuccess, onError }) => {
      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await api.post('/api/products/parse-file', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        setUploadedFile(file);
        setPreviewData(response.data.preview || []);

        // Автоматическое маппинг полей
        const headers = response.data.headers || [];
        const autoMapping = {};

        headers.forEach((header, index) => {
          const lowerHeader = header.toLowerCase();
          
          for (const [field, patterns] of Object.entries(fieldMappingRules)) {
            if (patterns.some(pattern => lowerHeader.includes(pattern))) {
              autoMapping[index] = field;
              break;
            }
          }
        });

        setMappingConfig(autoMapping);
        setCurrentStep(1);
        onSuccess(response.data);
      } catch (error) {
        message.error('Ошибка обработки файла');
        onError(error);
      }
    },
    onRemove: () => {
      setUploadedFile(null);
      setPreviewData([]);
      setMappingConfig({});
      setCurrentStep(0);
    }
  };

  const handleMapping = (columnIndex, field) => {
    setMappingConfig({
      ...mappingConfig,
      [columnIndex]: field
    });
  };

  const validateMapping = () => {
    const requiredFields = ['name', 'sku'];
    const mappedFields = Object.values(mappingConfig);

    const missingFields = requiredFields.filter(field => !mappedFields.includes(field));

    if (missingFields.length > 0) {
      message.error(`Необходимо указать соответствие для полей: ${missingFields.join(', ')}`);
      return false;
    }

    return true;
  };

  const proceedToImport = () => {
    if (!validateMapping()) return;
    if (!selectedSupplier) {
      message.error('Выберите поставщика');
      return;
    }

    setCurrentStep(2);
    performImport();
  };

  const performImport = async () => {
    try {
      const importData = {
        file_data: previewData,
        mapping: mappingConfig,
        supplier_id: selectedSupplier,
        options: importOptions
      };

      // Симуляция прогресса импорта
      const progressInterval = setInterval(() => {
        setImportProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + Math.random() * 10;
        });
      }, 200);

      const response = await dispatch(importProducts(importData)).unwrap();
      
      clearInterval(progressInterval);
      setImportProgress(100);
      setImportResults(response);
      setCurrentStep(3);

    } catch (error) {
      message.error('Ошибка импорта товаров');
      console.error('Import error:', error);
    }
  };

  const availableFields = [
    { value: '', label: 'Не использовать' },
    { value: 'name', label: 'Название' },
    { value: 'sku', label: 'Артикул (SKU)' },
    { value: 'price', label: 'Цена' },
    { value: 'quantity', label: 'Количество' },
    { value: 'description', label: 'Описание' },
    { value: 'category', label: 'Категория' },
    { value: 'brand', label: 'Бренд' },
    { value: 'weight', label: 'Вес' },
    { value: 'dimensions', label: 'Размеры' },
  ];

  const previewColumns = previewData.length > 0 ? 
    Object.keys(previewData[0]).map((key, index) => ({
      title: (
        <div>
          <div style={{ marginBottom: 8 }}>{key}</div>
          <Select
            style={{ width: '100%' }}
            placeholder="Выберите поле"
            value={mappingConfig[index] || ''}
            onChange={(value) => handleMapping(index, value)}
          >
            {availableFields.map(field => (
              <Option key={field.value} value={field.value}>
                {field.label}
              </Option>
            ))}
          </Select>
        </div>
      ),
      dataIndex: key,
      key: key,
    })) : [];

  const steps = [
    {
      title: 'Загрузка файла',
      content: (
        <div>
          <Alert
            message="Требования к файлу"
            description={
              <ul>
                <li>Поддерживаемые форматы: Excel (.xlsx, .xls), CSV</li>
                <li>Максимальный размер: 10MB</li>
                <li>Первая строка должна содержать заголовки</li>
                <li>Обязательные поля: Название, Артикул</li>
              </ul>
            }
            type="info"
            style={{ marginBottom: 16 }}
          />

          <Dragger {...uploadProps}>
            <p className="ant-upload-drag-icon">
              <FileExcelOutlined />
            </p>
            <p className="ant-upload-text">
              Нажмите или перетащите файл в эту область для загрузки
            </p>
            <p className="ant-upload-hint">
              Поддерживаются файлы Excel и CSV
            </p>
          </Dragger>

          {uploadedFile && (
            <Card style={{ marginTop: 16 }}>
              <Space>
                <FileExcelOutlined />
                <span>{uploadedFile.name}</span>
                <Tag color="green">Загружен</Tag>
              </Space>
            </Card>
          )}
        </div>
      ),
    },
    {
      title: 'Настройка полей',
      content: (
        <div>
          <Alert
            message="Настройте соответствие полей"
            description="Укажите, какие колонки файла соответствуют полям товара. Обязательные поля отмечены красным цветом."
            type="info"
            style={{ marginBottom: 16 }}
          />

          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={12}>
              <Select
                style={{ width: '100%' }}
                placeholder="Выберите поставщика"
                value={selectedSupplier}
                onChange={setSelectedSupplier}
              >
                {suppliers.map(supplier => (
                  <Option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </Option>
                ))}
              </Select>
            </Col>
            <Col span={12}>
              <Space>
                <Checkbox
                  checked={importOptions.updateExisting}
                  onChange={(e) => setImportOptions({
                    ...importOptions,
                    updateExisting: e.target.checked
                  })}
                >
                  Обновлять существующие
                </Checkbox>
                <Checkbox
                  checked={importOptions.createCategories}
                  onChange={(e) => setImportOptions({
                    ...importOptions,
                    createCategories: e.target.checked
                  })}
                >
                  Создавать категории
                </Checkbox>
              </Space>
            </Col>
          </Row>

          <Table
            dataSource={previewData.slice(0, 5)}
            columns={previewColumns}
            pagination={false}
            scroll={{ x: 'max-content' }}
            size="small"
          />

          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <Button type="primary" onClick={proceedToImport}>
              Начать импорт
            </Button>
          </div>
        </div>
      ),
    },
    {
      title: 'Импорт',
      content: (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Title level={4}>Импорт товаров</Title>
          <Progress
            type="circle"
            percent={Math.round(importProgress)}
            style={{ marginBottom: 16 }}
          />
          <div>Обработка данных...</div>
        </div>
      ),
    },
    {
      title: 'Завершение',
      content: (
        <div>
          <Alert
            message="Импорт завершен"
            type="success"
            style={{ marginBottom: 16 }}
          />

          <Row gutter={16}>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Добавлено"
                  value={importResults?.created || 0}
                  valueStyle={{ color: '#3f8600' }}
                  prefix={<CheckCircleOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Обновлено"
                  value={importResults?.updated || 0}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="С ошибками"
                  value={importResults?.errors || 0}
                  valueStyle={{ color: '#cf1322' }}
                  prefix={<ExclamationCircleOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Пропущено"
                  value={importResults?.skipped || 0}
                  valueStyle={{ color: '#d46b08' }}
                />
              </Card>
            </Col>
          </Row>

          {importResults?.errorDetails && importResults.errorDetails.length > 0 && (
            <Card title="Ошибки импорта" style={{ marginTop: 16 }}>
              <Table
                dataSource={importResults.errorDetails}
                columns={[
                  { title: 'Строка', dataIndex: 'row', width: 80 },
                  { title: 'Поле', dataIndex: 'field', width: 120 },
                  { title: 'Значение', dataIndex: 'value', width: 150 },
                  { title: 'Ошибка', dataIndex: 'error' }
                ]}
                pagination={{ pageSize: 5 }}
                size="small"
              />
            </Card>
          )}

          <div style={{ marginTop: 24, textAlign: 'right' }}>
            <Space>
              <Button onClick={handleClose}>
                Закрыть
              </Button>
              <Button type="primary" onClick={handleFinish}>
                Перейти к товарам
              </Button>
            </Space>
          </div>
        </div>
      ),
    },
  ];

  return (
    <Modal
      title="Импорт товаров"
      open={visible}
      onCancel={handleClose}
      footer={null}
      width={1000}
      destroyOnClose
    >
      <Steps current={currentStep} style={{ marginBottom: 24 }}>
        {steps.map(item => (
          <Step key={item.title} title={item.title} />
        ))}
      </Steps>

      <div>{steps[currentStep].content}</div>
    </Modal>
  );
};

export default ProductImport;